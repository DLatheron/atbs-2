import { createGameQCreateGameQueryuerySchema, CreateGameQuery, CreateGameResponse } from '@atbs/shared-data';
import type { RequestHandler } from 'express';
import { Game } from '../../../game/Game.js';
import { gameManager } from '../../../game/GameManager.js';

export const createGame: RequestHandler = (req, res) => {
	const parsed = CreateGameQuery.safeParse(req.query);

	if (!parsed.success) {
		res.status(400).json({ error: 'client-id query parameter is required' });
		return;
	}

	const game = new Game();
	gameManager.addGame(game);

	const clientId = parsed.data['client-id'];
	if (!game.addClient(clientId)) {
		res.status(500).json({ error: 'Failed to add client to created game ' });
		return;
	}

	const payload = CreateGameResponse.parse({
		gameId: game.gameId,
	});

	res.json(payload);
};
