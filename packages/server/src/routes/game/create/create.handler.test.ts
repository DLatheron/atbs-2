import { CreateGameResponseBody } from "@atbs/shared-data";
import { gameManager } from "../../../game/GameManager.js";
import { createGame } from "./create.handler.js";

function createMockResponse() {
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(payload: unknown) {
            this.body = payload;
            return this;
        }
    };
    return res;
}

describe("createGame", () => {
    it("returns a gameId when client-id is provided", () => {
        const res = createMockResponse();

        createGame({ query: { "client-id": "player-1" } } as never, res as never, () => undefined);

        const payload = CreateGameResponseBody.parse(res.body);
        expect(payload.gameId).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
        expect(gameManager.getGame(payload.gameId).gameId).toBe(payload.gameId);
    });

    it("accepts optional auto-join=true", () => {
        const res = createMockResponse();

        createGame(
            { query: { "client-id": "player-1", "auto-join": "true" } } as never,
            res as never,
            () => undefined
        );

        expect(CreateGameResponseBody.parse(res.body).gameId).toBeTruthy();
    });

    it("returns 400 when client-id is missing", () => {
        const res = createMockResponse();

        createGame({ query: {} } as never, res as never, () => undefined);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "client-id query parameter is required" });
    });
});
