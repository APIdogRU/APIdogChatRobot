import * as TelegramBot from 'node-telegram-bot-api';
import { DAY, getRandomInt, HOUR } from './utils';
import { Reply } from './reply';
import { IReasonJoke } from './interfaces';

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

export default (message: TelegramBot.Message, reply: () => Reply) => {

	const ent = message.entities[0];
	const substr = message.text.substr(ent.offset, ent.length);

	jokes.some(joke => {
		if (joke.command === substr) {
			let str = ['Joke'];

			str.push(`name = ${joke.command}`);
			str.push(`delta = ${joke.delta}`);
			str.push(`colldown = ${joke.coolDown}`);

			reply().text(str.join('\n')).send();
			return true;
		}
	});
};
