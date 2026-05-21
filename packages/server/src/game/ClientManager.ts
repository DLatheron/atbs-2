import { ClientId } from '@atbs/shared-data';
import { Client } from './Client.js';

export class ClientManager {
	private readonly clients = new Map<ClientId, Client>();

	addClient(client: Client): void {
		this.clients.set(client.clientId, client);
	}

	removeClient(clientId: ClientId): boolean {
		return this.clients.delete(clientId);
	}

	getClient(clientId: ClientId): Client {
		const client = this.findClient(clientId);
		if (!client) {
			throw new Error(`Client not found: ${clientId}`);
		}
		return client;
	}

	findClient(clientId: ClientId): Client | undefined {
		return this.clients.get(clientId);
	}
}
