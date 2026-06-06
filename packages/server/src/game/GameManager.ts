import { GameId } from "@atbs/shared-data";
import { Game } from "./Game.js";

export class GameManager {
    private readonly _games = new Map<GameId, Game>();

    addGame(game: Game): void {
        this._games.set(game.gameId, game);
    }

    removeGame(gameId: string): boolean {
        return this._games.delete(gameId);
    }

    getGame(gameId: string): Game {
        const game = this.findGame(gameId);
        if (!game) {
            throw new Error(`Game not found: ${gameId}`);
        }
        return game;
    }

    findGame(gameId: string): Game | undefined {
        return this._games.get(gameId);
    }

    killAllGames() {
        for (const game of this._games.values()) {
            game.destroyGame();
        }

        this._games.clear();

        console.info("All games killed", this._games);
    }

    findOnlyGame(): GameId | undefined {
        return this._games.values().next().value?.gameId;
    }
}

export const gameManager = new GameManager();
