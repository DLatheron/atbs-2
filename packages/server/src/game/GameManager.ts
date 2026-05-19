import { Game } from './Game.js';

export class GameManager {
	private readonly games = new Map<string, Game>();

	addGame(game: Game): void {
		this.games.set(game.gameId, game);
	}

	removeGame(gameId: string): boolean {
		return this.games.delete(gameId);
	}

	getGame(gameId: string): Game {
		const game = this.findGame(gameId);
		if (!game) {
			throw new Error(`Game not found: ${gameId}`);
		}
		return game;
	}

	findGame(gameId: string): Game | undefined {
		return this.games.get(gameId);
	}
}

export const gameManager = new GameManager();
