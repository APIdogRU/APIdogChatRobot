/***********
 * Утилиты *
 ***********/

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
