import type { ClientId } from "@atbs/shared-data";

export class Client {
    private readonly _clientId: ClientId;
    private _name: string;

    constructor(clientId: string, name: string) {
        this._clientId = clientId;
        this._name = name;
    }

    get clientId(): ClientId {
        return this._clientId;
    }

    get name(): string {
        return this._name;
    }
}
