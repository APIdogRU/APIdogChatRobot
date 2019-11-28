import { CanvasRenderingContext2D, loadImage } from 'canvas';

/**
 * Нарисовать квадрат
 * @param ctx Контекст холста
 * @param color Цвет
 * @param x Координата X
 * @param y Координата Y
 * @param width Ширина квадрата
 * @param height Высота квадрата
 */
const drawRect = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number
) => {
	ctx.fillStyle = color;
	ctx.fillRect(x, y, width, height);
};

/**
 * Нарисовать пикчу на холсте
 * @param ctx Контекст холста
 * @param url Адрес до изображения
 * @param x Координата X
 * @param y Координата Y
 * @param width Ширина изображения
 * @param height Высота изображения
 * @param radius Радиус закругления (ненулевой, если нужен)
 */
const drawImage = async(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, width: number, height: number, radius: number = 0) => {
	const image = await loadImage(url);

	ctx.save();
	if (radius > 0) {
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
		ctx.clip();
	}

	ctx.drawImage(image, x, y, width, height);
	ctx.restore();
};

export {
	drawImage,
	drawRect
};
