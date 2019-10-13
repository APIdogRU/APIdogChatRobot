import * as TelegramBot from 'node-telegram-bot-api';
import { InlineKeyboardButton } from 'node-telegram-bot-api';

class InlineKeyboardRow {

	private readonly buttons: InlineKeyboardButton[];

	constructor() {
		this.buttons = [];
	}

	addStringButton(text: string, data: string) {
		this.buttons.push({ text, callback_data: data })
	}

	make(): InlineKeyboardButton[] {
		return this.buttons;
	}

}

class InlineKeyboard {

	private readonly rows: InlineKeyboardRow[];

	constructor() {
		this.rows = [];
	}

	addRow() {
		const row = new InlineKeyboardRow();
		this.rows.push(row);
		return row;
	}


	public make(): TelegramBot.InlineKeyboardMarkup {
		return {
			inline_keyboard: this.rows.map(row => row.make())
		}
	}
}

export default InlineKeyboard;
