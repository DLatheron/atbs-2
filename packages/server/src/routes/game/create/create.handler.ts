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

export const createGame: RequestHandler = (req: CreateGameRequest, res: CreateGameResponse) => {
    const parsedBody = CreateGameRequestBody.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({ error: `invalid payload: ${parsedBody.error.toString()}` });
        return;
    }
    const { clientId, name } = parsedBody.data;

    const game = new Game();
    gameManager.addGame(game);
    if (!game.addClient(clientId, name)) {
        res.status(500).json({ error: "Failed to add client to created game " });
        return;
    }

    res.json({ gameId: game.gameId });
};
