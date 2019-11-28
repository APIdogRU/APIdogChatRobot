import TelegramBot, { Sticker } from 'node-telegram-bot-api';

export type Callable<T> = () => T;

export interface IKarmaValue {
	karma: number;
}

export interface IKarmaItem extends IKarmaValue {
	userId: number;
	username: string;
}

export interface IPunishment {
	isStrict: boolean;
	deltaKarma?: number;
	banDuration?: number;
	action?: (bot: TelegramBot) => void;
}

export interface ICheckMessage {
	message: TelegramBot.Message;
	user: ILocalUser;
	bot: TelegramBot;
}

export interface ILocalUser {
	telegramId: number;
	username: string;
	firstName: string;
	lastName: string;
	count: number;
	karma: number;
	__cached: number;
}

export type IRule = (m: ICheckMessage) => IPunishment | null | undefined;

/**
 * Расширение интерфейса для анимированных стикеров
 * Ибо в стандартной библиотеке их нет
 */
export interface AnimatedSticker extends Sticker {
	// eslint-disable-next-line camelcase
	is_animated: boolean;
}

/**
 * Причины повышения рейтинга (команды-шутки)
 */
export type IReasonJoke = 'antivk' | 'fuckmrg' | 'pray' | 'fuckrkn' | 'praygnu';

/**
 * Причины изменения рейтинга
 */
export type IReason = IReasonJoke;

/**
 * Опции для транзакций кармы
 */
export interface ITransferKarmaOptions {
	reason?: IReason;
	coolDown?: number | Callable<number>;
}

/**
 * Результат транзакции кармы
 */
export interface ITransferKarmaResult {
	from?: {
		was: number
		now: number;
	};
	to?: {
		was: number;
		now: number;
	};
}

/**
 * Вымышленный юзер
 */
export const USER_DEV_NULL = -777;

/**
 * Информация о кулдауне
 */
export interface ICoolDownInfo {
	reason: IReason;
	until: number;
}
