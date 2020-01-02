import TelegramBot from 'node-telegram-bot-api';
import InlineKeyboard from './keyboards';
import reply from './reply';

/**
 * Ключи юзеров
 */
type TUserKey = 'v' | 't' | 'd' | 'c' | 'k';

/**
 * Ключи юзеров и иды
 */
const ids: Record<TUserKey, number> = {
	v: 63923,
	t: 97781725,
	d: 87476169,
	c: 485056,
	k: 257534697
};

/**
 * Ключи юзеров и юзернеймы
 */
const names: Record<TUserKey, string> = {
	v: 'vladislav805',
	t: 'Whoops',
	d: 'leodicapri',
	c: 'longpoll',
	k: 'soslowman'
};

// Игры
type TGame = 'game_cs' | 'game_pl';

// Ответ
type TAnswer = 'y' | 'n';

const KB_KEY_CS: TGame = 'game_cs';
const KB_KEY_PL: TGame = 'game_pl';

type TUserVote = Partial<Record<TUserKey, boolean>>;

/*
 * 0 game
 * 1 keys_all
 * 2 keys_accept
 * 3 keys_decline
 * 4 answer y/n
 */

const toString = (list: TUserVote) => Object.keys(list).join('');

const toObject = (str: string): TUserVote => str.split('').reduce((prev, curr) => {
	prev[curr as TUserKey] = true;
	return prev;
}, {} as TUserVote);

const isEmpty = (list: TUserVote) => Object.keys(list).length === 0;

/**
 * Запаковка данных для кнопок
 * @param game Игра
 * @param keys Ожидаемые игроки
 * @param accept Согласившиеся игроки
 * @param decline Отказавшиеся игроки
 * @param answer Ответ
 */
const pack = (game: TGame, keys: TUserVote, accept: TUserVote, decline: TUserVote, answer: TAnswer) => {
	return [game, toString(keys), toString(accept), toString(decline), answer].join('/');
};

/**
 * Распаковка данных кнопки
 * @param str Строка data
 */
const unpack = (str: string): { game: TGame, keys: TUserVote, accept: TUserVote, decline: TUserVote, answer: TAnswer } => {
	const [game, keys, accept, decline, answer] = str.split('/');
	return {
		game: game as TGame,
		keys: toObject(keys),
		accept: toObject(accept),
		decline: toObject(decline),
		answer: answer as TAnswer
	};
};

/**
 * Создание строки для сообщения
 * @param game Игра
 * @param keys Ожидаемые игроки
 * @param accept Согласившиеся игроки
 * @param decline Отказавшиеся игроки
 * @returns Строка для сообщения
 */
const getMessageText = (game: TGame, keys: TUserVote, accept: TUserVote, decline: TUserVote) => {
	const blocks = [];

	if (!isEmpty(keys)) {
		blocks.push(`**Wait for**\n${getUserList(keys)}`);
	}

	if (!isEmpty(accept)) {
		blocks.push(`Y: ${getUserList(accept, ', ')}`);
	}

	if (!isEmpty(decline)) {
		blocks.push(`N: ${getUserList(decline, ', ')}`);
	}

	return `**Ping for ${game.replace('game_', '').toUpperCase()}**\n` + blocks.join('\n\n');
};

/**
 * Получение форматированной строки с юзернеймами пользователей
 * @param keys Ключи игроков
 * @param joiner Строка-соеденитель
 */
const getUserList = (keys: TUserVote, joiner = '\n') => Object.keys(keys).map(key => `@${names[key as TUserKey]}`).join(joiner);

/**
 * Получение ключа игрока по его ид
 * @param id Ид юзера в Telegram
 */
const getKeyById = (id: number): TUserKey | null => {
	const arr = Object.keys(ids) as TUserKey[];

	for (let i = 0; i < arr.length; ++i) {
		if (ids[arr[i]] === id) {
			return arr[i];
		}
	}

	return null;
};

/**
 * Создание клавиатуры для сообщения
 * @param game Игра
 * @param keys Ожидаемые игроки
 * @param accept Согласившиеся игроки
 * @param decline Отказавшиеся игроки
 */
const getKeyboard = (game: TGame, keys: TUserVote, accept: TUserVote, decline: TUserVote) => {
	const kb: InlineKeyboard = new InlineKeyboard();
	const kbRow = kb.addRow();
	kbRow.addStringButton('Y', pack(game, keys, accept, decline, 'y'));
	kbRow.addStringButton('N', pack(game, keys, accept, decline, 'n'));
	return kb.make();
};

/**
 * Инициализация игрового модуля
 * @param bot Telegram-бот
 */
export default async function initGameVote(bot: TelegramBot) {
	const createListener = (game: TGame) => {
		return (message: TelegramBot.Message, match: string[]) => {
			const keysStr = match[2];

			if (!keysStr || !keysStr.length) {
				reply(bot, message).text(`Не указаны тиммейты. Доступные ключи: \`${Object.keys(ids).join('`, `')}\``).send();
				return;
			}

			const keys = toObject(keysStr);

			bot.sendMessage(message.chat.id, getMessageText(game, keys, {}, {}), {
				disable_notification: false,
				parse_mode: 'Markdown',
				reply_to_message_id: message.message_id,
				reply_markup: getKeyboard(game, keys, {}, {})
			});
		};
	};

	bot.onText(new RegExp(`^\\/cs(\\s-([${Object.keys(ids).join('')}]+))?`, 'igm'), createListener(KB_KEY_CS));
	bot.onText(new RegExp(`^\\/pubg(\\s-([${Object.keys(ids).join('')}]+))?`, 'igm'), createListener(KB_KEY_PL));

	bot.on('callback_query', ({ from, message, data, id }) => {
		const key = getKeyById(from.id);

		const { game, keys, accept, decline, answer } = unpack(data);

		if (!([KB_KEY_CS, KB_KEY_PL].includes(game))) {
			return;
		}

		if (!key || !(key in keys)) {
			bot.answerCallbackQuery(id, {
				cache_time: 1800,
				show_alert: true,
				text: 'Вас не спрашивали'
			});
			return;
		}

		switch (answer) {
			case 'y': accept[key] = true; break;
			case 'n': decline[key] = true; break;
			default: return;
		}

		delete keys[key];

		const text = getMessageText(game, keys, accept, decline);

		bot.editMessageText(text, {
			chat_id: message.chat.id,
			message_id: message.message_id,
			parse_mode: 'Markdown',
			reply_markup: getKeyboard(game, keys, accept, decline)
		});
	});

	bot.on('polling_error', error => console.error(error));
};
