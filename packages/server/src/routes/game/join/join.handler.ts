import { ErrorResponseBody, JoinGameRequestBody, JoinGameResponseBody } from "@atbs/shared-data";
import type { Request, RequestHandler, Response } from "express";
import { gameManager } from "../../../game/GameManager.js";

export type JoinGameRequest = Request<unknown, JoinGameRequestBody>;
export type JoinGameResponse = Response<JoinGameResponseBody | ErrorResponseBody>;

export const joinGame: RequestHandler = (req: JoinGameRequest, res: JoinGameResponse) => {
    const parsedBody = JoinGameRequestBody.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({ error: `invalid payload: ${parsedBody.error.toString()}` });
        return;
    }
    const { gameId, clientId, name } = parsedBody.data;

    const game = gameManager.findGame(gameId);
    if (!game) {
        res.status(404).json({ error: `game ${gameId} not found` });
        return;
    }
    if (!game.addClient(clientId, name)) {
        res.status(500).json({ error: "Failed to add client to created game " });
        return;
    }

    res.json({ gameId: game.gameId });
};
