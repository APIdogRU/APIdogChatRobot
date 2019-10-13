import TelegramBot from 'node-telegram-bot-api';
import mysql from 'mysql';
import reply, { Reply } from './reply';
import config from './config'
import { DAY, packAction, unpackAction } from './utils';
import InlineKeyboard from './keyboards';
import { parseTimeInterval } from './time';

let database: mysql.Connection;

type VoteBanAnswer = 1 | 0;

interface IVoteBanItem {
	voteId: number;
	messageId: number;
	voterUserId: number;
	answer: VoteBanAnswer;
}

/**
 * Блокировка пользователей
 *
 * Пермиссивная блокировка администраторами
 * /ban N, где N - длительность
 *
 * Пользовательское голосование на блокировку
 * /voteban N, где N - длительность
 *     N может быть не менее 30 секунд и не более одного дня
 */

const wrapQuery = async <T>(database: mysql.Connection, sql: string, args?: (string | number)[]) => new Promise<T>((resolve, reject) => {
	database.query(sql, args, (error: mysql.MysqlError, results: T) => {
		if (error) {
			reject(error);
		}
		resolve(results);
	});
});

class BanUser {
	private userId: number;
	private duration?: number;
	private delta?: number;

	constructor(userId: number) {
		this.userId = userId;
	}

	public setDuration(duration: number): void {
		this.duration = this.checkDuration(duration);
	}

	private checkDuration(duration: number): number {
		if (duration < 30 || duration > DAY) {
			throw new Error('Длительность блокировки должна быть не менее 30 секунд и не более дня.');
		}
		return duration;
	}

	public setDelta(delta: number): void {
		this.delta = delta;
	}
}

const getVoteBanData = async (messageId: number) => {
	const items = await wrapQuery<IVoteBanItem[]>(database, 'select * from `tgVoteban` where `messageId` = ?', [messageId]);

	let yes = 0, no = 0;

	items.forEach((item: IVoteBanItem) => item.answer ? ++yes : ++no);

	return {yes, no};
};



const addVoteBanAnswer = async (messageId: number, voterId: number, answer: VoteBanAnswer) => {
	const result = await wrapQuery<void>(
		database,
		'insert into `tgVoteban` (`messageId`, `voterUserId`, `answer`) VALUES (?, ?, ?)',
		[messageId, voterId, answer]
	);

	return getVoteBanData(messageId);
};

const packVoteBan = (m: TelegramBot.Message, yes: boolean) => packAction(ACTION_VB, [
	m.message_id,
	m.from.id,
	+yes
]);

const createKeyboardVoteBan = (target: TelegramBot.Message, yes: number, no: number) => {
	const kb: InlineKeyboard = new InlineKeyboard();
	const kbRow = kb.addRow();
	kbRow.addStringButton(`Да [${yes}]`, packVoteBan(target, true));
	kbRow.addStringButton(`Нет [${no}]`, packVoteBan(target, false));
	return kb.make();
};

const ACTION_VB = 'voteban';

export default (bot: TelegramBot, argDatabase: mysql.Connection) => {
	database = argDatabase;

	bot.onText(/\/voteban2( ([\ddhms]+))?/, async (message: TelegramBot.Message, match: string[]) => {
		// Сообщение того, кого баним
		const target: TelegramBot.Message = message.reply_to_message;

		// Кто банит
		const suitor: TelegramBot.User = message.from;

		// Ответ на сообщение, автора которого баним
		const rpl = reply(bot, message).asReply(target.message_id);

		const msg = async (): Promise<Reply> => {
			if (!target) {
				throw new Error('Не выбрано сообщение');
			}

			// Враг народа
			const enemy: TelegramBot.User = target.from;

			// Мазохист
			if (enemy.id === message.from.id) {
				throw new Error('Самого себя забанить? Мощно.');
			}

			// Админы
			if (config.admins.includes(enemy.id)) {
				throw new Error('Нельзя банить админов.');
			}

			if (!match || !match.length) {
				throw new Error('Не указана длительность предлагаемого бана');
			}

			const duration = parseTimeInterval(match[2]);

			if (duration < 30 || duration > DAY) {
				throw new Error('Длительность блокировки должна быть не менее 30 секунд и не более дня.');
			}

			const res = await addVoteBanAnswer(target.message_id, message.from.id, +1);

			return rpl.text(`Охуел ли в конец ${enemy.first_name} ${enemy.last_name} (@${enemy.username})?`)
				.setReplyTarget(target)
				.replyMarkup(createKeyboardVoteBan(target, res.yes, res.no));
		};
		try {
			(await msg()).send();
		} catch (e) {
			console.error(e);
			rpl.text(`❌ Ошибка!\n\n${e.message}`).send();
		}
	});

	bot.on('callback_query', async (query: TelegramBot.CallbackQuery) => {
		const {action, args} = unpackAction(query.data);

		if (action !== ACTION_VB) {
			return;
		}

		// Кто нажал
		const user: TelegramBot.User = query.from;

		const [messageId, enemyId, answer ] = args;

		const messageVote = query.message; // Сообщение бота
		const targetMessage = messageVote.reply_to_message; // Сообщение за которое бан

		console.log(`User ${user.username}/${user.id} clicked button ${answer} on voteban for ${targetMessage.from.username}/${targetMessage.from.id}`);
		console.log(messageVote.message_id, user.id, answer === '1');

		if (user.id === targetMessage.from.id) {
			// noinspection ES6MissingAwait
			bot.answerCallbackQuery(query.id, { text: 'Тебе нельзя проголосовать в этом опросе', show_alert: true });
			return;
		}

		try {
			const ans = +(answer === '1') as VoteBanAnswer;
			const res = await addVoteBanAnswer(messageVote.message_id, user.id, ans);

			await bot.editMessageReplyMarkup(createKeyboardVoteBan(targetMessage, res.yes, res.no), {
				chat_id: messageVote.chat.id,
				message_id: messageVote.message_id
			});
		} catch (e) {
			if (~e.message.indexOf('ER_DUP_ENTRY')) {

				// noinspection ES6MissingAwait
				bot.answerCallbackQuery(query.id, { text: 'Голос уже учтён.' });

				return;
			}

			if (~e.message.indexOf('message is not modified')) {
				return;
			}

			reply(bot, messageVote).text(`❌ Ошибка:\n<pre>${e.message}</pre>`).asReply().send();
			console.error(`Error while add vote`, e);
		}
	});
}
