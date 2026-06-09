import type { ClientToServerMessage, Phase } from "@atbs/shared-data";
import type { ClientMessageManager, Game } from "../Game.js";
import type { Client } from "../Client.js";
import type { HandlerHandle } from "@atbs/misc";
import type { MessageRouter } from "../MessageRouter.js";

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

    protected get messageRouter(): MessageRouter {
        return this._game.messageRouter;
    }

    abstract get phase(): Phase;

    get acceptingClients(): boolean {
        return false;
    }

    async initialise() {}

    async uninitialise() {}

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
