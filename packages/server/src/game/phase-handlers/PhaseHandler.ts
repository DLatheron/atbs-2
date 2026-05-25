import { Phase } from "@atbs/shared-data";
import type { ClientMessageManager, Game } from "../Game.js";
import type { Client } from "../Client.js";

export abstract class PhaseHandler {
    private readonly _game: Game;

    constructor(game: Game) {
        this._game = game;
    }

    protected get game(): Game {
        return this._game;
    }

    abstract get phase(): Phase;

    get acceptingClients(): boolean {
        return false;
    }

    abstract registerMessageHandlers(messageManager: ClientMessageManager): void;
    abstract unregisterMessageHandlers(messageManager: ClientMessageManager): void;

    clientConnected(client: Client): void {
        console.info(`GENERIC: *** Client '${client.name}' (${client.clientId}) connected ***`);
    }

    clientDisconnected(client: Client): void {
        console.info(`GENERIC: *** Client '${client.name}' (${client.clientId}) disconnected ***`);
    }
}
