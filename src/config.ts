import de from 'dotenv';
import fs from 'fs';
import path from 'path';

export interface IConfig {
	admins: number[]
	targetChatId: number;
	robotId: number;
	oldBotId: number;
	restricts: {
		stickers: string[];
		stickerSets: string[];
	};
	boratUserIds: number[];
	banCongratulationPhrases: string[];
}

de.config();

const productionConfig = path.resolve(__dirname, 'config.production.ts');

let data;

if (fs.existsSync(productionConfig)) {
	data = import(productionConfig);
} else {
	data = {
		admins: [],

		targetChatId: +process.env.TELEGRAM_CHAT_ID,

		robotId: +process.env.TELEGRAM_BOT_ID,
		oldBotId: 0,

		restricts: {
			stickers: [],
			stickerSets: []
		},

		boratUserIds: [],

		banCongratulationPhrases: []
	};
}

export default data as IConfig;
