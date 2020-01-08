import config from './config';

import { bot, db } from './initial';
import reply from './reply';
import TelegramBot from 'node-telegram-bot-api';

import raveInit from './rave';
import karmaInit from './karma';
import banInit from './bans';
import usersInit from './users';
import registerScreenshoter from './screenshot';
import { getRandomInt } from './utils';
import * as http from 'http';

bot.onText(/\/test/i, (msg: TelegramBot.Message) => {
	reply(bot, msg).text('Up').asReply().send();
});

bot.onText(/\/ping/i, (msg: TelegramBot.Message) => {
	reply(bot, msg).text('пинга для пидорасов и ебанов').asReply().send();
});

bot.onText(/\/roll/i, (msg: TelegramBot.Message) => {
	reply(bot, msg).text(['ОРЁЛ', 'РЕШКА'][getRandomInt(1)]).send();
});

bot.onText(/\/red/i, (msg: TelegramBot.Message) => {
	if (!msg.reply_to_message) {
		reply(bot, msg).text('Нет ответа').asReply().send();
		return;
	}

	const url = msg.reply_to_message.text;

	require('https').get(url, (res: http.IncomingMessage) => {
		let data = '';
		res.on('data', (chunk: string) => {
			data += chunk;
		});

		res.on('end', () => {
			const res = /<meta property="og:image" content="([^"]+)"\/>/ig.exec(data);

			const image = res[1]?.replace(/&amp;/ig, '&');

			if (!image) {
				reply(bot, msg).text('Пикчу не нашёл').asReply().send();
				return;
			}

			bot.sendPhoto(msg.chat.id, image, {
				reply_to_message_id: msg.message_id,
				disable_notification: true
			});
		});
	}).on('error', (e: Error) => {
		reply(bot, msg).text(`error: ${e.toString()}`).asReply().send();
	});
});

raveInit(bot);
karmaInit(bot, db);
banInit(bot, db);
registerScreenshoter(bot);
usersInit(bot, db);

process.addListener('beforeExit', () => {
	bot.sendMessage(config.targetChatId, 'process killed');
});
