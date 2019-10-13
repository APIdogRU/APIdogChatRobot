import { getNow, MINUTE } from './utils';
import { ICheckMessage, IPunishment } from './interfaces';

/******************
 * Контроль флуда *
 ******************/
const USER_FLOOD_TTL = 10;
const USER_FLOOD_MAX_COUNT = 5;
const history: Record<number, number[]> = {};

export default (m: ICheckMessage): IPunishment => {
	const userId: number = m.message.from.id;

	if (!(userId in history)) {
		history[userId] = [];
	}

	const now: number = getNow();

	history[userId].unshift(now);

	const count = history[userId].reduce(((count: number, item: number) => {
		if (now - item < USER_FLOOD_TTL) {
			++count;
		}
		return count;
	}), 0);

	history[userId].length = 5;

	if (count >= USER_FLOOD_MAX_COUNT) {
		const karma = m.user.karma;
		return {
			isStrict: !(karma > 0),
			banDuration: karma > 0
				? 0
				: 10 * MINUTE,
			deltaKarma: -250
		};
	}

	return null;
};
