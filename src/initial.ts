import Socks5HttpsAgent from 'socks5-https-client/lib/Agent';
import TelegramBot from 'node-telegram-bot-api';
import mysql from 'mysql';

const token = process.env.TELEGRAM_BOT_TOKEN;

const request: any = process.env.PROXY_ENABLE && {
	agentClass: Socks5HttpsAgent,
	agentOptions: {
		socksHost: process.env.PROXY_HOST,
		socksPort: process.env.PROXY_PORT,
		socksUsername: process.env.PROXY_USERNAME,
		socksPassword: process.env.PROXY_PASSWORD
	}
};

const options = {
	polling: true,
	request
};

const bot: TelegramBot = new TelegramBot(token, options);

const db = mysql.createConnection({
	host: process.env.DATABASE_HOST,
	user: process.env.DATABASE_USER,
	password: process.env.DATABASE_PASSWORD,
	database: process.env.DATABASE_NAME
});

export { bot, db };
