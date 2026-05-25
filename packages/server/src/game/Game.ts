import { randomInt } from "node:crypto";
import { ClientId, ClientToServerMessage } from "@atbs/shared-data";
import { Client } from "./Client.js";
import { ClientManager } from "./ClientManager.js";
import type { PhaseHandler } from "./phase-handlers/PhaseHandler.js";
import { LobbyPhaseHandler } from "./phase-handlers/LobbyPhaseHandler.js";
import { MessageManager } from "@atbs/misc";

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
    private readonly _gameId: string;
    private readonly _clientManager: ClientManager;
    private readonly _context: ClientMessageContext;
    private readonly _messageManager: ClientMessageManager;

    private _phaseHandler: PhaseHandler;

    constructor() {
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

    clientConnected(client: Client): void {
        this._phaseHandler.clientConnected(client);
    }

    clientDisconnected(client: Client): void {
        this._phaseHandler.clientDisconnected(client);
    }

    receiveMessage(data: MessageEvent, from: Client) {
        const messageString = data.toString();
        const message = ClientToServerMessage.parse(JSON.parse(messageString));

        this._messageManager.enqueueMessage(message, from);
    }
}
