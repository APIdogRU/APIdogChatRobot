/***********
 * Утилиты *
 ***********/

import * as http from 'http';

/**
 * Текущее время в unixtime (seconds)
 */
export const getNow = () => Math.floor(Date.now() / 1000);

/**
 * Рандомное число [0; max]
 * @param max
 */
export const getRandomInt = (max: number) => {
	return Math.floor(Math.random() * Math.floor(max + 1));
};

export const MINUTE = 60;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * Запаковка callback_data в строку (до 64 байт!)
 * @param action Действие
 * @param args Аргументы
 */
export const packAction = (action: string, args: (string | number)[]) => {
	return action + '/' + args.join('/');
};

/**
 * Распаковка данных из callback_data
 * @param packed
 */
export const unpackAction = (packed: string) => {
	const args = packed.split('/');
	return { action: args.shift(), args: args };
};

/**
 * Человеческий вывод дельты кармы
 * @param value Карма
 */
export const formatKarma = (value: number) => (value > 0 ? '+' : '-') + Math.abs(value);

export const getRedditPreviewImage = (url: string) => new Promise<string>((resolve, reject) => {
	require('https').get(url, (res: http.IncomingMessage) => {
		let data = '';
		res.on('data', chunk => {
			data += chunk;
		});

		res.on('end', () => {
			const res = /<meta property="og:image" content="([^"]+)"\/>/ig.exec(data);

			const image = res[1]?.replace(/&amp;/ig, '&');

			if (!image) {
				reject(new Error('Нет пикчи'));
				return;
			}

			resolve(image);
		});
	}).on('error', (e: Error) => {
		reject(e);
	});
});
