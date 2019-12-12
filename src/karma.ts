import TelegramBot from 'node-telegram-bot-api';
import mysql from 'mysql';
import reply from './reply';
import { query } from './db';
import { formatKarma, getNow } from './utils';

import handleJoke from './jokes';
import handleRules from './rules';
import { ICheckMessage, ICoolDownInfo, IKarmaItem, ILocalUser, ITransferKarmaOptions, ITransferKarmaResult, USER_DEV_NULL } from './interfaces';
import { toStringDateTime } from './time';
import * as Sugar from 'sugar';

/**
 * Линка на коннект к базе данных
 */
let database: mysql.Connection;
const coolDown: Record<number, ICoolDownInfo> = {};

/**
 * Получить данные о карме всех юзеров
 * @param database
 */
const fetchAllData = async(database: mysql.Connection): Promise<IKarmaItem[]> => {
	try {
		const sql = 'SELECT DISTINCT `userId`, `username`, IFNULL(SUM(`delta`), 0) AS `karma` FROM `tgUser` LEFT JOIN `tgRating` ON `tgUser`.`telegramId` = `tgRating`.`userId` GROUP BY `userId` ORDER BY `karma` DESC';

		return await query<IKarmaItem>(database, sql);
	} catch (e) {
		console.error('fetchAllData error', e);
	}
};

/**
 * Получить карму юзера по его идентификатору
 * @param userId
 */
export const getKarmaValue = async(userId: number) => {
	const sql = 'SELECT SUM(`delta`) AS `karma` FROM `tgRating` WHERE `userId` = ?';
	try {
		return await query<IKarmaItem>(database, sql, [userId]);
	} catch (e) {
		console.error('getKarmaValue error', e);
	}
};

export const makeKarmaTransaction = async(userId: number, delta: number) => {
	const sql = 'INS' + 'ERT INTO `tgRating` SET ?';

	const commit = async() => new Promise<void>(resolve => {
		database.query(sql, { userId, delta, date: getNow() }, (error: mysql.MysqlError, _results: void) => {
			if (error) throw error;
			resolve();
		});
	});

	await commit();

	return getKarmaValue(userId);
};

export const transferKarma = async(diff: number, from: number, to: number, options?: ITransferKarmaOptions): Promise<ITransferKarmaResult> => {
	if (!to || to === USER_DEV_NULL) {
		throw new Error('Чё это за юзер?');
	}

	if (diff < 0) {
		throw new Error('Семки есть?');
	}

	if (to === from) {
		throw new Error('анонист');
	}

	const now = getNow();
	if (to in coolDown && coolDown[to].until > now) {
		throw new Error(`Кулдаун, осталось ${toStringDateTime(coolDown[to].until - now)}`);
	}

	const result: ITransferKarmaResult = {
		from: undefined,
		to: undefined
	};

	if (from !== USER_DEV_NULL) {
		const [fromUserBefore] = await getKarmaValue(from);
		const fromKarma = fromUserBefore.karma;

		if (fromKarma - diff < 0) {
			throw new Error(`Недостаточно кармы для перевода\n<b>Необходимо</b>: ${diff}\n<b>В наличии</b>: ${fromKarma}`);
		}

		const [fromUserAfter] = await makeKarmaTransaction(from, -diff);

		result.from = {
			was: fromKarma,
			now: fromUserAfter.karma
		};
	}
	const [targetUserBefore] = await getKarmaValue(to);
	const [targetUserAfter] = await makeKarmaTransaction(to, diff);

	result.to = {
		was: targetUserBefore.karma,
		now: targetUserAfter.karma
	};

	if (options && options.coolDown) {
		const timeout = Sugar.Object.isFunction(options.coolDown)
			? options.coolDown()
			: options.coolDown;

		coolDown[to] = {
			reason: options.reason,
			until: timeout
		};
	}

	return result;
};

/**
 * По умолчанию у всех кармы 10000
 *
 * Информация о карме
 * Информацию о карме можно получить с помощью команды /karma.
 *
 * Передача кармы
 * Карму можно передавать с помощью команды `/F N`, где N - количество кармы для передачи.
 * Передачей кармы можно воспользоваться не чаще раза в 30 минут.
 * (A передает B карму - в течение 30 минут никто более не может передать B карму)
 *
 * Получение кармы
 * Карму можно заработать, написав команды:
 * | Команда  | Дельта кармы |      Кулдаун на вызов         |
 * | /antivk  |       4      |            1 час              |
 * | /fuckmrg |       8      |            1 час              |
 * | /pray    |      12      |            2 часа             |
 * | /fuckrkn |      16      |           24 часа             |
 * | /praygnu |      42      | Рандом от 30 секунд до 7 дней |
 *
 * Лишение кармы
 * Карма взымается за:
 *     Написание триггер-слов:
 *     +   "навальный" и прочие формы,
 *     +   "удачи братан" и прочие формы,
 *     +   "без комментариев и прочие формы,
 *         "джигурда" и прочие формы,
 *     +   "аниме" и прочие формы,
 *     +   "владик" и прочие формы -
 *     +       При положительной карме:
 *     +           снимается 20% от кармы, но не менее 250,
 *     +       При отрицательной карме:
 *     +           снимается 500 + блокировка на abs(N) секунд, где N - количество кармы;
 *   + Отправка триггер стикеров/стикеров из определенных стикерпаков (скрытый список) -
 *     +   При положительной карме:
 *     +       снимается 20% от кармы, но не менее 250,
 *     +   При отрицательной карме:
 *     +       снимается 500 + блокировка на abs(N) секунд, где N - количество кармы;
 *   + Отправка анимированных стикеров:
 *     +   Снимается 100 кармы + удаление стикера;
 *   + При отправке более 5 сообщений за 10 секунд:
 *     +   При положительной карме:
 *     +       снимается 250 кармы,
 *     +   При отрицательной карме:
 *     +       снимается 250 кармы + блокировка на 10 минут;
 *     При принятии решения о блокировке пользователя через /voteban:
 *     	   В случае, если не указана длительность блокировки:
 *             При положительной карме:
 *                 снимается 10% кармы;
 *             При отрицательной карме:
 *                 снимается 300 кармы + блокировка на 10 минут;
 *         В случае, если указана длительность блокировки:
 *             При положительной карме:
 *                 снимается 10% кармы + если длительность более 30 минут - 5% от указанного времени, но не менее 30 секунд;
 *             При отрицательной карме:
 *                 снимается 500 кармы + блокировка на указанный срок, но не менее 30 секунд и не более 1 дня;
 */

// TTL для кэша информации о пользователе
const userCacheTTL = 30;

// Объект для
const __localCached: Record<string | number, ILocalUser> = {};

const fetchUser = async(telegramUserId: number): Promise<ILocalUser> => {
	try {
		const result = await query<ILocalUser>(
			database,
			'select `tgUser`.*, sum(`tgRating`.`delta`) as `karma` from `tgUser` left join `tgRating` on `tgUser`.`telegramId` = `tgRating`.`userId` where `userId` = ?',
			[telegramUserId]
		);

		const user = result[0];
		user.__cached = getNow();
		return user;
	} catch (e) {
		throw new Error('SQL failed');
	}
};

/**
 * Получение полной информации о пользователе по userId
 * @param telegramUserId
 */
const getUserData = async(telegramUserId: number): Promise<ILocalUser> => {
	const hasInCache = telegramUserId in __localCached;
	const isFresh = hasInCache && getNow() - __localCached[telegramUserId].__cached < userCacheTTL;

	if (hasInCache && isFresh) {
		return __localCached[telegramUserId];
	}

	const user = await fetchUser(telegramUserId);
	__localCached[telegramUserId] = user;

	return user;
};

export default (bot: TelegramBot, argDatabase: mysql.Connection) => {
	database = argDatabase;

	// Кэш всех юзеров
	fetchAllData(database);

	const listener = async(message: TelegramBot.Message) => {
		// Инфа о юзере
		const user: ILocalUser = await getUserData(message.from.id);

		// Бандл для проверок
		const checkBundle: ICheckMessage = { message, user, bot };

		// Отправлятор
		const sender = () => reply(bot, message);

		if (!message.edit_date) {
			await handleRules(checkBundle, sender);
		}

		const isCommand = message.entities && message.entities.length && message.entities[0].type === 'bot_command';

		if (isCommand) {
			handleJoke(message, sender);
		}
	};

	bot.on('message', listener);
	bot.on('edited_message', listener);

	bot.onText(/\/F (-?\d+)/i, async(message: TelegramBot.Message, match: string[]) => {
		const rpl = reply(bot, message).asReply();
		try {
			const fromUser = message.from;

			if (!('reply_to_message' in message)) {
				// noinspection ExceptionCaughtLocallyJS
				throw new Error('Не указано сообщение для передачи кармы автору');
			}

			const toUser = message.reply_to_message.from;

			const diff = parseInt(match[1]);

			const result = await transferKarma(diff, fromUser.id, toUser.id);

			rpl.text(`✅ Успешно\n\n<b>${fromUser.username}</b>\n<code>${result.from.was} [ ${formatKarma(diff)} ] ${result.from.now}</code>\n\n<b>${toUser.username}</b>\n<code>${result.to.was} [ ${formatKarma(diff)} ] ${result.to.now}</code>`).send();
		} catch (e) {
			rpl.text(`❌ Ошибка!\n\n${e.message}`).send();
			console.error(e);
		}
	});

	bot.onText(/\/karma/i, async(message: TelegramBot.Message) => {
		const replyMsg = message.reply_to_message;

		if (!replyMsg) {
			const table = await fetchAllData(database);

			const str = table.map((user: IKarmaItem, index: number) => `\`${index + 1}. ${user.karma} ${user.username}\``);

			reply(bot, message).text(str.join('\n')).parseMode('Markdown').send();
		} else {
			const user = replyMsg.from;
			const karma = await getKarmaValue(user.id);
			reply(bot, message).text(`Карма ${user.username} равна ${karma}`);
		}
	});
};
