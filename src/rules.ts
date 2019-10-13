import { AnimatedSticker, ICheckMessage, IPunishment, IRule } from './interfaces';
import checkFlood from './flood';
import config from './config';
import { MINUTE } from './utils';
import { Reply } from './reply';

/******************************************************
 * Проверка сообщения, наказание и отправка сообщения *
 ******************************************************/

/**
 * Стандартное наказание
 * @param m Бандл сообщения
 */
const defaultPunishment = (m: ICheckMessage): IPunishment => ({
	isStrict: !(m.user.karma > 0),
	banDuration: m.user.karma > 0
		? 5 * MINUTE
		: Math.abs(m.user.karma),
	deltaKarma: m.user.karma > 0
		? -Math.max(250, m.user.karma * .2)
		: -500
});

/**
 * Проверка на триггер сообщения
 * @param m Бандл сообщения
 * @param r Регулярка
 */
const checkTrigger = (m: ICheckMessage, r: RegExp): IPunishment | null => r.test(m.message.text) && defaultPunishment(m);

/**
 * Правила по блокам
 * Ключ => функция, возвращающая null или IPunishment
 */
const rules: Record<string, IRule> = {

	'check-flood': checkFlood,

	// triggers
	'trigger-test': m => checkTrigger(m, /qwerty1/igm),

	'trigger-navalny': m => checkTrigger(m, /[нh][аa@о][вb][аa@о]л[ьb][нh]ый/igm),
	'trigger-putin': m => checkTrigger(m, /[пpр][уyu][тt][иi][нnh]/igm),
	'trigger-good_luck': m => checkTrigger(m, /[уy]д[аa@]чи бр(о|[аa@]т((аa@)н|юня))/igm),
	'trigger-no_comments': m => checkTrigger(m, /б[еe]з [кk][оoаa@]мм?[еeи][нh][тt]([аa@]ри[еe][вb]|[оo][вb])/igm),
	'trigger-vladik': m => checkTrigger(m, /([вb]л[аa@]ди[кk]|vl[aа@]di[cс][kк])/igm),
	'trigger-anime': m => checkTrigger(m, /[аa@оo][нnh][иieе][мm][еeэ]/igm),

	'trigger-stickerpack-bad': m => m.message.sticker && config.restricts.stickerSets.indexOf(m.message.sticker.set_name) >= 0 && defaultPunishment(m),
	'trigger-sticker-bad': m => m.message.sticker && config.restricts.stickers.indexOf(m.message.sticker.file_id) >= 0 && defaultPunishment(m),
	'trigger-sticker-animated': m => m.message.sticker && (m.message.sticker as AnimatedSticker).is_animated && {
		isStrict: false,
		deltaKarma: 100,
		action: (bot) => bot.deleteMessage(m.message.chat.id, String(m.message.message_id))
	}

};

export default (checkBundle: ICheckMessage, reply: () => Reply) => {
	Object.keys(rules).some(key => {
		process.stdout.write(`check for [${key}] ...\r`);
		const test: IPunishment | null = rules[key](checkBundle);
		process.stdout.write(`check for [${key}] - ${test}\n`);
		if (test) {
			let str = ['Triggered'];

			str.push(`name trigger = ${key}`);
			str.push(`is strict = ${test.isStrict}`);
			str.push(`delta karma = ${test.deltaKarma}`);
			str.push(`ban duration = ${test.banDuration}`);
			str.push(`action? = ${test.action ? test.action.toString() : null}`);

			reply().text(str.join('\n')).send();
			return true;
		}
	});
}