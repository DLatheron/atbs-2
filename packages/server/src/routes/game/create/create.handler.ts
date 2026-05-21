import { CreateGameRequestBody, CreateGameResponseBody } from '@atbs/shared-data';
import type { RequestHandler } from 'express';
import { Game } from '../../../game/Game.js';
import { gameManager } from '../../../game/GameManager.js';

export const createGame: RequestHandler = (req, res) => {
	const parsedBody = CreateGameRequestBody.safeParse(req.body);

	if (!parsedBody.success) {
		res.status(400).json({ error: 'client-id query parameter is required' });
		return;
	}

	const game = new Game();
	gameManager.addGame(game);

	const { clientId, name } = parsedBody.data;
	if (!game.addClient(clientId, name)) {
		res.status(500).json({ error: 'Failed to add client to created game ' });
		return;
	}

	const body = CreateGameResponseBody.parse({
		gameId: game.gameId,
	});

	// TODO: Add type to res so that it doesn't need zod above...
	res.json(body);
};
