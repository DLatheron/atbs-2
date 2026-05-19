import { randomInt } from 'node:crypto';

const GAME_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomSegment(length: number): string {
	let segment = '';
	for (let i = 0; i < length; i++) {
		segment += GAME_ID_CHARS[randomInt(GAME_ID_CHARS.length)];
	}
	return segment;
}

function generateGameId(): string {
	return `${randomSegment(4)}-${randomSegment(4)}`;
}

export class Game {
	readonly gameId: string;

	constructor() {
		this.gameId = generateGameId();
	}
}
