import type { ClientId, ServerToClientMessage } from "@atbs/shared-data";
import { ServerSocketContext } from "./ServerSocketContext.js";

export class Client {
    private readonly _clientId: ClientId;
    private _name: string;
    private _socketContext: ServerSocketContext | null;

    constructor(clientId: string, name: string) {
        this._clientId = clientId;
        this._name = name;
        this._socketContext = null;
    }

    get clientId(): ClientId {
        return this._clientId;
    }

    get name(): string {
        return this._name;
    }

    set socketContext(value: ServerSocketContext) {
        this._socketContext = value;
    }

    get socketContext() {
        if (!this._socketContext) {
            throw new Error("Client's socket context is null");
        }
        return this._socketContext;
    }

    send(message: ServerToClientMessage): void {
        this.socketContext.send(message);
    }
}
