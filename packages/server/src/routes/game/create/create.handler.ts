import {
    CreateGameRequestBody,
    CreateGameResponseBody,
    ErrorResponseBody
} from "@atbs/shared-data";
import type { Request, RequestHandler, Response } from "express";
import { Game } from "../../../game/Game.js";
import { gameManager } from "../../../game/GameManager.js";

export type CreateGameRequest = Request<unknown, CreateGameRequestBody>;
export type CreateGameResponse = Response<CreateGameResponseBody | ErrorResponseBody>;

export const createGame: RequestHandler = async (
    req: CreateGameRequest,
    res: CreateGameResponse
) => {
    const parsedBody = CreateGameRequestBody.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({ error: `invalid payload: ${parsedBody.error.toString()}` });
        return;
    }
    const { clientId, name } = parsedBody.data;

    const game = new Game(clientId, req.app.locals.scenarioManager);
    gameManager.addGame(game);

    // Temporary Hack: Scenario loading is non-fatal.
    const scenario = req.app.locals.scenarioManager.find("test-scenario");
    game.scenario = scenario;

    const client = game.addClient(clientId, name);
    if (!client) {
        res.status(500).json({ error: "Failed to add client to created game " });
        return;
    }

    res.json({ gameId: game.gameId });
};
