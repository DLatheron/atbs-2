import { ClientId } from "@atbs/shared-data";
import { EditorClient } from "./EditorClient.js";

export class EditorClientManager {
    private readonly _clients = new Map<ClientId, EditorClient>();

    get clients(): EditorClient[] {
        return Array.from(this._clients.values());
    }

    addClient(client: EditorClient): void {
        this._clients.set(client.id, client);
    }

    removeClient(clientId: ClientId): boolean {
        return this._clients.delete(clientId);
    }

    getClient(clientId: ClientId): EditorClient {
        const client = this.findClient(clientId);
        if (!client) {
            throw new Error(`Editor client not found: ${clientId}`);
        }
        return client;
    }

    findClient(clientId: ClientId): EditorClient | undefined {
        return this._clients.get(clientId);
    }
}
