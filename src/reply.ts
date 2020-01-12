import TelegramBot from 'node-telegram-bot-api';

/**********************************************
 * Вспомогательный класс для отправки ответов *
 **********************************************/

export class Reply {
	private bot: TelegramBot;
	private parent: TelegramBot.Message;
	private _text: string;
	private readonly options: TelegramBot.SendMessageOptions;
	private _deleteAfter = -1;
	private _deleteParentAlso = false;

	constructor(bot: TelegramBot, parent: TelegramBot.Message) {
		this.bot = bot;
		this.parent = parent;
		this._text = null;
		this.options = {
			parse_mode: 'HTML',
			reply_markup: undefined,
			reply_to_message_id: undefined,
			disable_notification: true,
			disable_web_page_preview: true
		};
	}

	text(text: string) {
		this._text = text;
		return this;
	}

	parseMode(mode: TelegramBot.ParseMode) {
		this.options.parse_mode = mode;
		return this;
	}

	replyMarkup(markup: TelegramBot.InlineKeyboardMarkup | TelegramBot.ReplyKeyboardMarkup) {
		this.options.reply_markup = markup;
		return this;
	}

	asReply(messageId: number = undefined) {
		this.options.reply_to_message_id = messageId || this.parent.message_id;
		return this;
	}

	setReplyTarget(message: TelegramBot.Message) {
		this.parent = message;
		return this;
	}

	showWebPagePreview() {
		this.options.disable_web_page_preview = false;
		return this;
	}

	noSilent() {
		this.options.disable_notification = false;
		return this;
	}

	deleteAfter(ms: number) {
		this._deleteAfter = ms;
		return this;
	}

	deleteParentAlso() {
		if (this._deleteAfter < 0) {
			throw new Error('Not specified deleteAfter(ms)');
		}
		this._deleteParentAlso = true;
		return this;
	}

	private __getProps(): TelegramBot.SendMessageOptions {
		const props: TelegramBot.SendMessageOptions = this.options;

		if (props.reply_markup === undefined) {
			delete props.reply_markup;
		}

		if (props.reply_to_message_id === undefined) {
			delete props.reply_to_message_id;
		}

		return props;
	}

	send = async() => {
		const message = await this.bot.sendMessage(this.parent.chat.id, this._text, this.__getProps());

		if (this._deleteAfter) {
			setTimeout(() => {
				if (this._deleteParentAlso) {
					this.bot.deleteMessage(this.parent.chat.id, String(this.parent.message_id));
				}
				this.bot.deleteMessage(this.parent.chat.id, String(message.message_id));
			}, this._deleteAfter);
			return;
		}

		return message;
	}
}

const reply = (bot: TelegramBot, message: TelegramBot.Message): Reply => new Reply(bot, message);

export default reply;
