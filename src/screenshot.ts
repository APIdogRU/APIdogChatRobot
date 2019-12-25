import TelegramBot from 'node-telegram-bot-api';
import reply from './reply';
import Canvas, { CanvasRenderingContext2D } from 'canvas';
import * as image from './image';
import config from './config';

const COLOR_BACKGROUND = '#0e1621';
const COLOR_MESSAGE = '#182533';
const COLOR_NAME = '#3aa2f3';
const COLOR_PHOTO_BG = '#4388b9';
const FONT_STYLE = '14px HelveticaNeue';

interface ISize {
	width: number;
	height: number;
}

interface IScreenShotProps extends Record<string, any> {
	ImageSize: ISize;
	PhotoSize: ISize;
	MessageSize: ISize;
	MessagePaddingSize: number;
	PaddingSize: number;
	LineHeight: number;
}

const getName = (user: TelegramBot.User) => user.first_name || `@${user.username}`;

const splitLinesForText = (ctx: CanvasRenderingContext2D, text: string, limit: number) => {
	const words = (text || '').split(' ');
	const result: string[] = [];
	let current = '';
	let currentWidth = 0;

	ctx.font = FONT_STYLE;
	ctx.textBaseline = 'top';

	const push = () => {
		result.push(current);
		current = '';
		currentWidth = 0;
	};

	for (let i = 0; i < words.length; ++i) {
		const wordLength = ctx.measureText(`${current} ${words[i]}`);
		currentWidth = wordLength.width;

		if (currentWidth >= limit) {
			push();
		}

		current += `${words[i]} `;
	}
	current && push();

	return result;
};

const getProfilePhotoUrl = async(bot: TelegramBot, userId: number): Promise<string> => {
	const result = await bot.getUserProfilePhotos(userId);
	if (!result.total_count) {
		return null;
	}
	const [last] = result.photos;
	const bestResolution = last.pop();
	return bot.getFileLink(bestResolution.file_id);
};

const prepareDataForDrawing = (ctx: CanvasRenderingContext2D, O: IScreenShotProps, message: TelegramBot.Message) => {
	const content = [];

	content.push({
		type: 'text',
		text: getName(message.from),
		color: COLOR_NAME,
		height: O.LineHeight + 2
	});

	if (message.reply_to_message) {
		const x = O.PaddingSize * 2 + O.MessagePaddingSize + O.PhotoSize.width + 2;
		const [firstLine] = splitLinesForText(ctx, message.reply_to_message.text, O.MessageSize.width - O.MessagePaddingSize * 2);
		content.push({
			type: 'line',
			x1: x,
			y1: -1,
			x2: x,
			y2: O.LineHeight * 2 + 1,
			color: COLOR_NAME,
			width: 2,
			height: 0
		});

		content.push({
			type: 'text',
			text: getName(message.reply_to_message.from),
			height: O.LineHeight,
			color: COLOR_NAME,
			shift: O.ShiftReplyMessageText
		});

		content.push({
			type: 'text',
			text: firstLine,
			height: O.LineHeight + 5,
			shift: O.ShiftReplyMessageText
		});
	}

	const lines = splitLinesForText(ctx, message.text, O.MessageSize.width - O.MessagePaddingSize * 2);
	content.push({
		type: 'text',
		text: lines.join('\n'),
		height: lines.length * O.LineHeight
	});

	return {
		height: content.reduce((p, c) => p + c.height, 0),
		content
	};
};

const makeScreenShot = async(bot: TelegramBot, message: TelegramBot.Message): Promise<Buffer> => {
	const O: IScreenShotProps = {
		LineHeight: 18,
		PaddingSize: 10,
		MessagePaddingSize: 10,
		PhotoSize: {
			width: 53,
			height: 53
		},
		MessageSize: {
			width: 400,
			height: 150
		},
		ImageSize: {
			width: 0,
			height: 10
		},
		ShiftReplyMessageText: 10
	};
	O.ImageSize.width = O.MessageSize.width + O.PhotoSize.width + O.PaddingSize * 2;

	let canvas = Canvas.createCanvas(O.ImageSize.width, O.ImageSize.height);
	let ctx = canvas.getContext('2d');

	const { height, content } = prepareDataForDrawing(ctx, O, message);

	O.ImageSize.height = height + O.PaddingSize * 2 + O.MessagePaddingSize * 2;
	O.MessageSize.height = O.ImageSize.height - O.PaddingSize * 2;

	canvas = Canvas.createCanvas(O.ImageSize.width, O.ImageSize.height);
	ctx = canvas.getContext('2d');

	// Background
	image.drawRect(ctx, COLOR_BACKGROUND, 0, 0, O.ImageSize.width, O.ImageSize.height);

	// Background message
	image.drawRect(
		ctx,
		COLOR_MESSAGE,
		O.PaddingSize * 2 + O.PhotoSize.width,
		O.PaddingSize,
		O.MessageSize.width,
		O.MessageSize.height
	);

	// Triangle
	const triangleSizeX = 6;
	const triangleSizeY = 10;
	const triangleRightX = O.PaddingSize * 2 + O.PhotoSize.width;
	const triangleRightY = O.ImageSize.height - O.PaddingSize;

	ctx.beginPath();
	ctx.fillStyle = COLOR_MESSAGE;
	ctx.moveTo(triangleRightX, triangleRightY - triangleSizeY);
	ctx.lineTo(triangleRightX, triangleRightY);
	ctx.lineTo(triangleRightX - triangleSizeX, triangleRightY);
	ctx.closePath();
	ctx.fill();

	const photoX = O.PaddingSize;
	const photoY = O.ImageSize.height - O.PaddingSize - O.PhotoSize.height;
	const photoHalf = O.PhotoSize.width / 2;

	ctx.beginPath();
	ctx.arc(
		photoX + photoHalf,
		photoY + photoHalf,
		photoHalf,
		0,
		2 * Math.PI,
		false
	);
	ctx.fillStyle = COLOR_PHOTO_BG;
	ctx.fill();
	ctx.closePath();

	const url = await getProfilePhotoUrl(bot, message.from.id);

	if (url) {
		// Photo user
		await image.drawImage(
			ctx,
			url,
			photoX,
			photoY,
			O.PhotoSize.width,
			O.PhotoSize.height,
			photoHalf
		);
	}

	ctx.font = FONT_STYLE;
	ctx.textBaseline = 'top';

	let currentY = O.PaddingSize + O.MessagePaddingSize;
	for (let i = 0; i < content.length; ++i) {
		const cur = content[i];

		switch (cur.type) {
			case 'text': {
				ctx.fillStyle = cur.color || 'white';
				let x = O.PaddingSize * 2 + O.MessagePaddingSize + O.PhotoSize.width;
				if (cur.shift) {
					x += cur.shift;
				}
				ctx.fillText(
					cur.text,
					x,
					currentY
				);
				currentY += cur.height;
				break;
			}

			case 'line': {
				ctx.beginPath();
				ctx.strokeStyle = cur.color;
				ctx.moveTo(cur.x1, currentY + cur.y1);
				ctx.lineTo(cur.x2, currentY + cur.y2);
				ctx.stroke();
				break;
			}
		}
	}

	// canvas.createPNGStream().pipe(fs.createWriteStream(path.join(__dirname, 'text.png')));

	return canvas.toBuffer();
};

export {
	makeScreenShot
};

export default (bot: TelegramBot) => {
	bot.onText(/\/snap/img, async(message: TelegramBot.Message) => {
		let { reply_to_message: replyMessage } = message;

		if (!replyMessage) {
			reply(bot, message).text('Не выбрано сообщение').asReply().send();
			return;
		}

		if (String(replyMessage.from.id) === String(process.env.ADMIN_ID)) {
			message.reply_to_message = null;
			replyMessage = message;
		}

		const photo = await makeScreenShot(bot, replyMessage);

		await bot.sendPhoto(message.chat.id, photo, {
			reply_to_message_id: message.message_id
		});
	});
};
