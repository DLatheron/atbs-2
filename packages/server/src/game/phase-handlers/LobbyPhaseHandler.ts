import { ClientId, LobbyState, Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager } from "../Game.js";
import { Client } from "../Client.js";

const AUTO_POPULATE_SCENARIO = true; // Temporary Hack.

export class LobbyPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.Values.lobby;
    }

    get acceptingClients(): boolean {
        return true; // Potentially limit the maximum number of clients that can join the lobby.
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        messageManager.registerHandler("client:rename", ({ game }, payload, from) => {
            const { clientId } = from;
            const { name } = payload;
            const client = game.getClient(clientId);
            const { name: oldName } = client;
            client.name = name;

            game.broadcastMessage({
                type: "server:client:renamed",
                payload: {
                    oldName,
                    newName: name
                }
            });
            game.broadcastMessage({
                type: "lobby:state",
                payload: this._buildLobbyState()
            });
        });
    }

    unregisterMessageHandlers(messageManager: ClientMessageManager): void {
        messageManager.unregisterHandler("client:rename");
    }

    clientConnected(client: Client): void {
        console.info(`LOBBY: *** Client '${client.name}' (${client.clientId}) connected ***`);

        // Tell everyone else we have a new client.
        this.game.broadcastMessage(
            {
                type: "lobby:client:connected",
                payload: {
                    clientId: client.clientId,
                    name: client.name
                }
            },
            client.clientId
        );

        // Tell everyone about the updated lobby state.
        this.game.broadcastMessage({
            type: "lobby:state",
            payload: this._buildLobbyState()
        });
    }

    clientDisconnected(client: Client): void {
        console.info(`LOBBY: *** Client '${client.name}' (${client.clientId}) disconnected ***`);

        this.game.broadcastMessage({
            type: "lobby:client:disconnected",
            payload: {
                clientId: client.clientId,
                name: client.name
            }
        });
        this.game.broadcastMessage({
            type: "lobby:state",
            payload: this._buildLobbyState(client.clientId)
        });
    }

    private _buildLobbyState(excludeId?: ClientId): LobbyState {
        const { clients } = this.game;

        return {
            ownerId: this.game.ownerId,
            clients: clients
                .filter(({ clientId }) => clientId != excludeId)
                .map((client) => ({
                    id: client.clientId,
                    name: client.name,
                    ready: false
                })),
            ...(
                AUTO_POPULATE_SCENARIO ? {
                    scenario: {
                        id: "test-scenario",
                        name: "Test Scenario",
                        description: [
                            { text: "This is a test scenario designed specifically to test the ATBS framework, its not real and can't be played.", pb: 2 },
                            { text: "It has multiple paragraphs of description." },
                            { line: true }
                        ],
                        sides: [
                            {
                                id: "side-1",
                                name: "Side 1",
                                description: [
                                    { text: "The first side", pb: 2 }
                                ]
                            },
                            {
                                id: "side-2",
                                name: "Side 2",
                                description: [
                                    { text: "The second side", pb: 2 }
                                ]
                            }
                        ]
                    }
                } : {}
            )
        };
    }
}
