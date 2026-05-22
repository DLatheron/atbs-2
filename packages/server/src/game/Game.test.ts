import { Game } from "./Game.js";

const GAME_ID_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

describe("Game", () => {
    it("generates a gameId in ZZZZ-ZZZZ format", () => {
        const game = new Game();

        expect(game.gameId).toMatch(GAME_ID_PATTERN);
    });

    it("generates unique gameIds", () => {
        const ids = new Set(Array.from({ length: 50 }, () => new Game().gameId));

        expect(ids.size).toBe(50);
    });
});
