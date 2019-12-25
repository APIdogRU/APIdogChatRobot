import TelegramBot from 'node-telegram-bot-api';
import mysql from 'mysql';
import reply from './reply';
import { getKarmaValue } from './karma';

const generateText = async(message: TelegramBot.Message) => {
	if (!message) {
		return 'А де мессага?';
	}

	const lines = ['<b>Info</b>'];
	lines.push('<pre>' + JSON.stringify(message.from, null, '  ') + '</pre>');
	lines.push('\n<b>Karma</b>');
	lines.push(String((await getKarmaValue(message.from.id))[0].karma));

	return lines.join('\n');
};

export default (bot: TelegramBot, argDatabase: mysql.Connection) => {
	bot.onText(/^\/info/ig, async message => {
		reply(bot, message)
			.text(await generateText(message.reply_to_message))
			.parseMode('HTML')
			.asReply()
			.send();
	});
};
