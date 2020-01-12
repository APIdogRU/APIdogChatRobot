import config from './config';

import { bot, db } from './initial';
import reply from './reply';
import TelegramBot from 'node-telegram-bot-api';

import raveInit from './rave';
import karmaInit from './karma';
import banInit from './bans';
import usersInit from './users';
import registerScreenshoter from './screenshot';
import { getRandomInt, getRedditPreviewImage } from './utils';

bot.onText(/\/test/i, (msg: TelegramBot.Message) => {
	reply(bot, msg).text('Up').asReply().send();
});

bot.onText(/\/ping/i, (msg: TelegramBot.Message) => {
	reply(bot, msg).text('пинга для пидорасов и ебанов').asReply().send();
});

bot.onText(/\/roll/i, (msg: TelegramBot.Message) => {
	reply(bot, msg).text(['ОРЁЛ', 'РЕШКА'][getRandomInt(1)]).send();
});

bot.onText(/(https?:\/\/((www\.)?reddit\.com|redd\.it)\/[^\s]+)/igm, (msg: TelegramBot.Message, matches: string[]) => {
	const url = matches[1];
	const rpl = reply(bot, msg);

	if (!url) {
		rpl.text(`Нет урла; matches = ${JSON.stringify(matches)}`);
		return;
	}

	getRedditPreviewImage(url).then(image => {
		bot.sendPhoto(msg.chat.id, image, {
			reply_to_message_id: msg.message_id
		});
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
