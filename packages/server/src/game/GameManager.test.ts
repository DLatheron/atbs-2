import { Game } from "./Game.js";
import { GameManager } from "./GameManager.js";

describe("GameManager", () => {
    it("adds and retrieves a game by id", () => {
        const manager = new GameManager();
        const game = new Game();

        manager.addGame(game);

        expect(manager.getGame(game.gameId)).toBe(game);
    });

    it("throws when getting an unknown game id", () => {
        const manager = new GameManager();

        expect(() => manager.getGame("ABCD-1234")).toThrow("Game not found: ABCD-1234");
    });

    it("finds a game by id", () => {
        const manager = new GameManager();
        const game = new Game();

        manager.addGame(game);

        expect(manager.findGame(game.gameId)).toBe(game);
    });

    it("returns undefined when finding an unknown game id", () => {
        const manager = new GameManager();

        expect(manager.findGame("ABCD-1234")).toBeUndefined();
    });

    it("removes a game by id", () => {
        const manager = new GameManager();
        const game = new Game();

        manager.addGame(game);
        expect(manager.removeGame(game.gameId)).toBe(true);
        expect(manager.findGame(game.gameId)).toBeUndefined();
        expect(() => manager.getGame(game.gameId)).toThrow("Game not found");
    });

    it("returns false when removing an unknown game id", () => {
        const manager = new GameManager();

        expect(manager.removeGame("ABCD-1234")).toBe(false);
    });
});
