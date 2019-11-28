import config from './config';

import { bot, db } from './initial';
import reply from './reply';
import TelegramBot from 'node-telegram-bot-api';

import raveInit from './rave';
import karmaInit from './karma';
import banInit from './bans';
import { getRandomInt } from './utils';

bot.onText(/\/test/i, (msg: TelegramBot.Message) => {
	reply(bot, msg).text('Up').asReply().send();
});

bot.onText(/\/roll/i, (msg: TelegramBot.Message) => {
	reply(bot, msg).text(['ОРЁЛ', 'РЕШКА'][getRandomInt(1)]).send();
});

raveInit(bot);
karmaInit(bot, db);
banInit(bot, db);

process.addListener('beforeExit', () => {
	bot.sendMessage(config.targetChatId, 'process killed');
});
