import { randomInt } from "node:crypto";
import { ClientId, ClientToServerMessage, GameId, ServerToClientMessage } from "@atbs/shared-data";

import { Client } from "./Client.js";
import { ClientManager } from "./ClientManager.js";
import type { PhaseHandler } from "./phase-handlers/PhaseHandler.js";
import { LobbyPhaseHandler } from "./phase-handlers/LobbyPhaseHandler.js";
import { CastToArray, MessageManager } from "@atbs/misc";

const FIXED_GAME_ID = true; // Temporary Hack.

const GAME_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomSegment(length: number): string {
    let segment = "";
    for (let i = 0; i < length; i++) {
        segment += GAME_ID_CHARS[randomInt(GAME_ID_CHARS.length)];
    }
    return segment;
}

function generateGameId(): string {
    if (FIXED_GAME_ID) {
        return "AAAA-AAAA";
    } else {
        return `${randomSegment(4)}-${randomSegment(4)}`;
    }
}

interface ClientMessageContext {
    game: Game;
}

export type ClientMessageManager = MessageManager<
    ClientMessageContext,
    ClientToServerMessage,
    Client
>;

export class Game {
    private _ownerId: ClientId;
    private readonly _gameId: GameId;
    private readonly _clientManager: ClientManager;
    private readonly _context: ClientMessageContext;
    private readonly _messageManager: ClientMessageManager;

    private _phaseHandler: PhaseHandler;

    constructor(ownerId: ClientId) {
        this._ownerId = ownerId;
        this._gameId = generateGameId();
        this._clientManager = new ClientManager();

        this._context = { game: this };
        this._messageManager = new MessageManager<
            ClientMessageContext,
            ClientToServerMessage,
            Client
        >(this._context);

        this._registerMessageHandlers();

        this._phaseHandler = new LobbyPhaseHandler(this);
        this._phaseHandler.registerMessageHandlers(this._messageManager);
    }

    private _registerMessageHandlers() {
        this._messageManager.registerHandler("client:ping", () => {
            // console.dir({ handler: "client:ping", context, payload, from });
        });
    }

    // private _unregisterMessageHandlers() {
    //     this._messageManager.unregisterHandler("client:ping");
    // }

    get ownerId(): ClientId {
        return this._ownerId;
    }

    get owner(): Client {
        return this._clientManager.getClient(this.ownerId);
    }

    get gameId(): GameId {
        return this._gameId;
    }

    get clients(): Client[] {
        return this._clientManager.clients;
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

    clientConnected(client: Client): void {
        this._phaseHandler.clientConnected(client);
    }

    clientDisconnected(client: Client): void {
        this._phaseHandler.clientDisconnected(client);
    }

    sendMessage(message: ServerToClientMessage, to: ClientId | ClientId[]) {
        const clients = CastToArray(to).map((clientId) => this.getClient(clientId));

        clients.forEach((client) => client.sendMessage(message));
    }

    broadcastMessage(message: ServerToClientMessage, exclude?: ClientId | ClientId[]) {
        const excludes = exclude ? CastToArray(exclude) : [];

        for (const client of this._clientManager.clients) {
            if (!excludes.includes(client.clientId)) {
                client.sendMessage(message);
            }
        }
    }

    receiveMessage(data: MessageEvent, from: Client) {
        const messageString = data.toString();
        const message = ClientToServerMessage.parse(JSON.parse(messageString));

        this._messageManager.enqueueMessage(message, from);
    }
}
