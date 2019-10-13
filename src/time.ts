import { DAY, HOUR, MINUTE } from './utils';

type ITimeMulKey = 'd' | 'h' | 'm' | 's';

const mul = { s: 1, m: 60, h: 3600, d: 3600 * 24 };

const parseTimeInterval = (str: string) => {
	const reg = /(\d+)([smhd])/ig;

	let match, val, type;

	let s = 0;
	while ((match = reg.exec(str))) {
		[, val, type] = match;

		if (type in mul) {
			const item = parseInt(val) * mul[type as ITimeMulKey];
			s += item;
		} else {
			throw new Error('Неверный формат');
		}
	}

	return s;
};

const toStringDateTime = (seconds: number): string => {
	if (seconds < MINUTE) {
		return `seconds с.`;
	}

	const i = Math.floor;

	if (seconds < HOUR) {
		return `${i(seconds / MINUTE)} мин. ${toStringDateTime(seconds % MINUTE)}`;
	}

	if (seconds < DAY) {
		return `${i(seconds / HOUR)} ч., ${toStringDateTime(seconds % HOUR)}`;
	}

	return `${i(seconds / DAY)} д., ${toStringDateTime(seconds % DAY)}`;
};

export {
	parseTimeInterval,
	toStringDateTime
};
