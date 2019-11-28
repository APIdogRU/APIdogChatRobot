import http from 'http';
import TelegramBot from 'node-telegram-bot-api';
import reply from './reply'
import InlineKeyboard from "./keyboards";
import { getNow, getRandomInt } from "./utils";

// Source URL
const url = process.env.RAVE_URL;

const MINIMUM_TIMEOUT_FOR_UPDATE_RAVE_MESSAGE = 3;

// Database
let mRaveDb: Record<string, number>;

/**
 * Fetch data from remote
 */
const updateDatabase = async () => new Promise((resolve, reject) => http.get(url, (res) => {
	let body = '';

	res.on('data', chunk => (body += chunk));

	res.on('end', () => {
		mRaveDb = JSON.parse(body);
		resolve();
	});

	res.on('error', e => reject(e));

	console.log('get');
}));

/**
 * Generate phrase
 */
const getPhrase = () => {
	if (!mRaveDb) {
		return false;
	}

	const getWord = (index: number) => {
		let cur = 0;
		for (const word in mRaveDb) {
			if (!mRaveDb.hasOwnProperty(word)) {
				continue;
			}
			cur += mRaveDb[word];
			if (cur > index) {
				return word;
			}
		}
	};

	const result: string[] = [];

	const weight: number = Object.values(mRaveDb).reduce((p: number, c: number) => p + c, 0) as number;

	// Length of sentence
	const size = getRandomInt(16) + 2; // 2 ... 10

	for (let i = 0; i < size; ++i) {
		const index = getRandomInt(weight);
		result.push(getWord(index));
	}

	return result.join(' ');
};

updateDatabase();

export default function(bot: TelegramBot) {

	/**
	 * Default keyboard for rave messages
	 */
	const kb = new InlineKeyboard();
	kb.addRow().addStringButton('Ещё', 'update_rave');

	const keyboardForRave = kb.make();
	let lastClick = 0;

	/**
	 * Force update database
	 */
	bot.onText(/\/updaterave/, async (message) => {
		await updateDatabase();
		reply(bot, message).text('Перезагружено').send();
	});

	/**
	 * Request rave
	 */
	bot.onText(/\/rave/, (message) => {
		let text = getPhrase();

		if (!text) {
			text = 'failed';
		}

		reply(bot, message).text(text).replyMarkup(keyboardForRave).send();
	});

	/**
	 * Request update rave message
	 */
	bot.on('callback_query', (query: TelegramBot.CallbackQuery) => {
		if (query.data !== 'update_rave') {
			return;
		}

		if (getNow() - lastClick < MINIMUM_TIMEOUT_FOR_UPDATE_RAVE_MESSAGE) {
			return;
		}

		lastClick = getNow();

		let text = getPhrase();

		if (!text) {
			text = 'failed';
		}

		bot.editMessageText(text, {
			chat_id: query.message.chat.id,
			message_id: query.message.message_id,
			reply_markup: keyboardForRave
		});
	});
};
