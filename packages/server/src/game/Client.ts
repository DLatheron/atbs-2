import type { ClientId, ServerToClientMessage, SideId } from "@atbs/shared-data";
import { WebSocket } from "ws";
import type { Game } from "./Game.js";

export class Client {
    private readonly _game: Game;
    private readonly _id: ClientId;
    private _name: string;
    private _sideId: SideId | null;
    private _ready: boolean;
    private _socket: WebSocket | null;

    constructor({ id, name }: { id: ClientId; name: string }, game: Game) {
        this._game = game;
        this._id = id;
        this._name = name;
        this._sideId = null;
        this._ready = false;

        this._socket = null;
    }

    get id(): ClientId {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }

    get sideId(): SideId | null {
        return this._sideId;
    }

    set sideId(value: SideId | null) {
        this._sideId = value;

        if (!this._sideId) {
            this._ready = false;
        }
    }

    get ready(): boolean {
        return this._ready;
    }

    set ready(value: boolean) {
        this._ready = value;
    }

    get socket(): WebSocket | null {
        return this._socket;
    }

    assignSocket(value: WebSocket) {
        if (this._socket) {
            throw new Error("Socket already assigned for this client");
        }

        // eslint-disable-next-line @typescript-eslint/no-this-alias -- needs aliasing to prevent errors inside lambdas.
        const client = this;
        const { id, _game: game } = client;

        this._socket = value;

        value.on("message", function message(data: MessageEvent) {
            game.receiveMessage(data, client);
        });

        value.on("close", function close() {
            game.clientDisconnected(client);
            game.removeClient(id);
        });

        value.on("error", function error(error: unknown) {
            console.error(error);
        });

        game.clientConnected(this);
    }

    sendMessage(message: ServerToClientMessage): void {
        if (!this._socket) {
            throw new Error(`Socket not assigned to client ${this.id}`);
        }

        if (this._socket.readyState === WebSocket.OPEN) {
            this._socket.send(JSON.stringify(message));
        }
    }
}
