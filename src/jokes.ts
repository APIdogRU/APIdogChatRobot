import * as TelegramBot from 'node-telegram-bot-api';
import { DAY, formatKarma, getNow, getRandomInt, HOUR } from './utils';
import { Reply } from './reply';
import { IReasonJoke } from './interfaces';
import { makeKarmaTransaction } from './karma';
import { toStringDateTime } from './time';
import * as Sugar from 'sugar';

/***********************************************
 * Проверка и ответ на сообщения-команды-шутки *
 ***********************************************/

interface IJoke {
	command: string;
	delta: number | (() => number);
	coolDown: number | (() => number);
	label?: string | string[];
	reason: IReasonJoke;
}

const jokes: IJoke[] = [
	{ command: '/antivk', delta: 4, coolDown: HOUR, reason: 'antivk' },
	{ command: '/fuckmrg', delta: 8, coolDown: HOUR, reason: 'fuckmrg' },
	{ command: '/pray', delta: 12, coolDown: 2 * HOUR, reason: 'pray' },
	{ command: '/fuckrkn', delta: 16, coolDown: DAY, reason: 'fuckrkn' },
	{ command: '/praygnu', delta: 42, coolDown: () => 30 + getRandomInt(7 * DAY - 30), reason: 'praygnu' }
];

const coolDownInfo: Record<string, number> = {};

export default (message: TelegramBot.Message, reply: () => Reply) => {

	const ent = message.entities[0];
	const substr = message.text.substr(ent.offset, ent.length);

	const make = async (joke: IJoke) => {
		const now = getNow();
		const user = message.from;
		const coolDown = Sugar.Object.isFunction(joke.coolDown) ? joke.coolDown() : joke.coolDown;
		const key = user.id + '_' + joke.command.substring(1);

		if (coolDownInfo[key] + coolDown > now) {
			reply().text(`Рано. Осталось ${toStringDateTime(coolDownInfo[user.id] + coolDown - now)}`).asReply().send();
			return;
		}

		coolDownInfo[key] = now;

		const delta = Sugar.Object.isFunction(joke.delta) ? joke.delta() : joke.delta;
		const [{ karma: karmaNew }] = await makeKarmaTransaction(message.from.id, delta);

		reply().text(`<b>👤 ${user.username || user.first_name}</b>\n🔺 Карма: <code>${formatKarma(delta)}</code> -> <code>${karmaNew}</code>\n▫️ Кулдаун: ${toStringDateTime(coolDown)}`).asReply().send();
	};

	jokes.some(joke => {
		if (joke.command === substr) {

			make(joke);

			return true;
		}
	});
};
