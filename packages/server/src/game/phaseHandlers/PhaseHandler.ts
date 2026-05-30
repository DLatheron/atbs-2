import { ClientToServerMessage, Phase } from "@atbs/shared-data";
import type { ClientMessageManager, Game } from "../Game.js";
import type { Client } from "../Client.js";
import { HandlerHandle } from "@atbs/misc";

export abstract class PhaseHandler {
    private readonly _game: Game;
    protected _handlerHandles: HandlerHandle<
        ClientToServerMessage,
        ClientToServerMessage["type"]
    >[];

    constructor(game: Game) {
        this._game = game;
        this._handlerHandles = [];
    }

    protected get game(): Game {
        return this._game;
    }

    abstract get phase(): Phase;

    get acceptingClients(): boolean {
        return false;
    }

    abstract registerMessageHandlers(messageManager: ClientMessageManager): void;

    unregisterMessageHandlers(messageManager: ClientMessageManager) {
        messageManager.unregisterHandlers(this._handlerHandles);
        this._handlerHandles = [];
    }

    clientConnected(client: Client): void {
        console.info(`GENERIC: *** Client '${client.name}' (${client.id}) connected ***`);
    }

    clientDisconnected(client: Client): void {
        console.info(`GENERIC: *** Client '${client.name}' (${client.id}) disconnected ***`);
    }
}
