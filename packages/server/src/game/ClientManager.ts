import { Client } from './Client.js';

export class ClientManager {
	private readonly clients = new Map<string, Client>();

	addClient(client: Client): void {
		this.clients.set(client.clientId, client);
	}

	removeClient(clientId: string): boolean {
		return this.clients.delete(clientId);
	}

	getClient(clientId: string): Client {
		const client = this.findClient(clientId);
		if (!client) {
			throw new Error(`Client not found: ${clientId}`);
		}
		return client;
	}

	findClient(clientId: string): Client | undefined {
		return this.clients.get(clientId);
	}
}
