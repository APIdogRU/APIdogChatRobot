import TelegramBot from 'node-telegram-bot-api';
import mysql from 'mysql';
import reply, { Reply } from './reply';
import config from './config';
import { DAY, getNow, packAction, unpackAction } from './utils';
import InlineKeyboard from './keyboards';
import { parseTimeInterval, toStringDateTime } from './time';
import { query } from './db';

let database: mysql.Connection;

type VoteBanAnswer = 1 | 0;

interface IVoteBanItem {
	voteId: number;
	messageId: number;
	voterUserId: number;
	answer: VoteBanAnswer;
}

const VOTE_MIN_COUNT = 3;
const ACTION_VB = 'voteban';

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

const getVoteBanData = async(messageId: number) => {
	const items = await query<IVoteBanItem>(database, 'select * from `tgVoteban` where `messageId` = ?', [messageId]);

	let yes = 0;
	let no = 0;

	items.forEach((item: IVoteBanItem) => item.answer ? ++yes : ++no);

	return { yes, no };
};

const addVoteBanAnswer = async(messageId: number, voterId: number, answer: VoteBanAnswer) => {
	await query<void>(
		database,
		'insert into `tgVoteban` (`messageId`, `voterUserId`, `answer`) VALUES (?, ?, ?)',
		[messageId, voterId, answer]
	);

	return getVoteBanData(messageId);
};

const packVoteBan = (m: TelegramBot.Message, duration: number, yes: VoteBanAnswer) => packAction(ACTION_VB, [
	m.message_id,
	m.from.id,
	duration,
	yes
]);

const createKeyboardVoteBan = (target: TelegramBot.Message, duration: number, yes: number, no: number) => {
	const kb: InlineKeyboard = new InlineKeyboard();
	const kbRow = kb.addRow();
	kbRow.addStringButton(`Да [ ${yes} ]`, packVoteBan(target, duration, 1));
	kbRow.addStringButton(`Нет [ ${no} ]`, packVoteBan(target, duration, 0));
	return kb.make();
};

const summarize = (bot: TelegramBot, badMessage: TelegramBot.Message, botMessage: TelegramBot.Message, banDuration: number) => {
	const { from: badUser, chat: targetChat } = badMessage;
	bot.deleteMessage(targetChat.id, String(botMessage.message_id));

	let text;

	if (banDuration) {
		bot.restrictChatMember(targetChat.id, String(badUser.id), {
			can_send_messages: false,
			until_date: getNow() + banDuration
		});

		text = `👍🏻 ${badUser.username} заблокирован на ${toStringDateTime(banDuration)}`;
	} else {
		text = `❌ ${badUser.username} не заблокирован`;
	}

	reply(bot, badMessage).text(text).asReply().send();
};

const voterRow = (answer: VoteBanAnswer, user: TelegramBot.User) => `${answer ? '➕' : '➖'} ${user.username || user.first_name}`;

export default (bot: TelegramBot, argDatabase: mysql.Connection) => {
	database = argDatabase;

	bot.onText(/\/voteban( ([\ddhms]+))?/, async(message: TelegramBot.Message, match: string[]) => {
		// Сообщение того, кого баним
		const target: TelegramBot.Message = message.reply_to_message;

		// Кто банит
		// const suitor: TelegramBot.User = message.from;

		// Ответ на сообщение, автора которого баним
		const rpl = reply(bot, message).asReply(target.message_id);

		const makeReply = async(): Promise<Reply> => {
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

			return rpl.text(`Охуел ли в конец ${enemy.first_name} ${enemy.last_name || ''} (${enemy.username ? '@' + enemy.username : 'no username'})?\n${voterRow(1, message.from)}`)
				.setReplyTarget(target)
				.replyMarkup(createKeyboardVoteBan(target, duration, res.yes, res.no));
		};
		try {
			(await makeReply()).send();
		} catch (e) {
			console.error(e);
			rpl.text(`❌ Ошибка!\n\n${e.message}`).send();
		}
	});

	bot.on('callback_query', async(query: TelegramBot.CallbackQuery) => {
		const { action, args } = unpackAction(query.data);

		if (action !== ACTION_VB) {
			return;
		}

		// Кто нажал
		const user: TelegramBot.User = query.from;

		const [message, from, duration, answer] = args;

		const messageVote = query.message; // Сообщение бота
		const targetMessage = messageVote.reply_to_message; // Сообщение за которое бан

		console.log(`User ${user.username}/${user.id} clicked button ${answer} on voteban for ${targetMessage.from && targetMessage.from.username}/${targetMessage.from && targetMessage.from.id}`);


		if (user.id === targetMessage.from.id) {
			// noinspection ES6MissingAwait
			bot.answerCallbackQuery(query.id, { text: 'Тебе нельзя проголосовать в этом опросе', show_alert: true });
			return;
		}

		try {
			const ans = +(answer === '1') as VoteBanAnswer;
			const res = await addVoteBanAnswer(targetMessage.message_id, user.id, ans);

			if (res.yes >= VOTE_MIN_COUNT || res.no >= VOTE_MIN_COUNT) {
				summarize(
					bot,
					targetMessage,
					messageVote,
					res.yes > res.no
						? +duration
						: 0
				);
				return;
			}

			const text = messageVote.text + `\n${voterRow(ans, user)}`;

			await bot.editMessageText(text, {
				reply_markup: createKeyboardVoteBan(targetMessage, +duration, res.yes, res.no),
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
			console.error('Error while add vote', e);
		}
	});
};
