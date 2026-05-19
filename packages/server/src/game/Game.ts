import { randomInt } from 'node:crypto';
import { Client } from './Client.js';
import { ClientManager } from './ClientManager.js';
import type { PhaseHandler } from './phase-handlers/PhaseHandler.js';
import { LobbyPhaseHandler } from './phase-handlers/LobbyPhaseHandler.js';

const GAME_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomSegment(length: number): string {
	let segment = '';
	for (let i = 0; i < length; i++) {
		segment += GAME_ID_CHARS[randomInt(GAME_ID_CHARS.length)];
	}
	return segment;
}

function generateGameId(): string {
	return `${randomSegment(4)}-${randomSegment(4)}`;
}

export class Game {
	private readonly _gameId: string;
	private readonly _clientManager: ClientManager;

	private _phaseHandler: PhaseHandler;

	constructor() {
		this._gameId = generateGameId();
		this._clientManager = new ClientManager();
		this._phaseHandler = new LobbyPhaseHandler();
	}

	reportError(error: string) {
		console.error(error);
	}

	addClient(clientId: string): Client | null {
		if (!this._phaseHandler.acceptingClients) {
			this.reportError(``);
			return null;
		}

		if (!this._clientManager.findClient(clientId)) {
			return null;
		}

		const client = new Client(clientId);
		this._clientManager.addClient(client);

		return client;
	}

	removeClient(clientId: string): boolean {
		return this._clientManager.removeClient(clientId);
	}
}
