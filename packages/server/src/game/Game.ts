import { randomInt } from 'node:crypto';
import { ClientId } from '@atbs/shared-data';
import { Client } from './Client.js';
import { ClientManager } from './ClientManager.js';
import type { PhaseHandler } from './phase-handlers/PhaseHandler.js';
import { LobbyPhaseHandler } from './phase-handlers/LobbyPhaseHandler.js';

const FIXED_GAME_ID = true; // Temporary Hack.

const GAME_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomSegment(length: number): string {
	let segment = '';
	for (let i = 0; i < length; i++) {
		segment += GAME_ID_CHARS[randomInt(GAME_ID_CHARS.length)];
	}
	return segment;
}

function generateGameId(): string {
	if (FIXED_GAME_ID) {
		return 'AAAA-AAAA';
	} else {
		return `${randomSegment(4)}-${randomSegment(4)}`;
	}
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

	get gameId() {
		return this._gameId;
	}

	reportError(error: string) {
		console.error(error);
	}

	/**
	 * Add a client to the game (if possible).
	 * Returns the `Client` is successful, otherwise `null`.
	 */
	addClient(clientId: ClientId, name: string): Client | null {
		if (!this._phaseHandler.acceptingClients) {
			this.reportError(``);
			return null;
		}

		if (this._clientManager.findClient(clientId)) {
			return null;
		}

		const client = new Client(clientId, name);
		this._clientManager.addClient(client);

		return client;
	}

	/**
	 * Remove a client from the game (if it exists).
	 * Returns `true` if the client was removed, otherwise `false`.
	 */
	removeClient(clientId: ClientId): boolean {
		return this._clientManager.removeClient(clientId);
	}

	getClient(clientId: ClientId) {
		return this._clientManager.getClient(clientId);
	}

	findClient(clientId: ClientId): Client | undefined {
		return this._clientManager.findClient(clientId);
	}
}
