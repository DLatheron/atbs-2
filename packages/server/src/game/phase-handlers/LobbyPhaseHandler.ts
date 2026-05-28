import { ClientId, LobbyState, Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager } from "../Game.js";
import { Client } from "../Client.js";

export class LobbyPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.Enum.lobby;
    }

    get acceptingClients(): boolean {
        return true; // Potentially limit the maximum number of clients that can join the lobby.
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        messageManager.registerHandler("client:rename", ({ game }, payload, from) => {
            const { id: clientId } = from;
            const { name } = payload;
            const client = game.getClient(clientId);
            const { name: oldName } = client;
            client.name = name;

            game.broadcastMessage({
                type: "lobby:client:renamed",
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
        messageManager.registerHandler(
            "client:side:change",
            ({ game }, payload, { id: fromClientId }) => {
                const { ownerId } = game;
                const { clientId, sideId: newSideId } = payload;

                if (fromClientId !== ownerId && fromClientId !== clientId) {
                    console.error(
                        `Attempt by client ${fromClientId} to set ${clientId} to side ${newSideId}`
                    );
                    return;
                }

                const client = game.getClient(clientId);
                const { sideId: oldSideId } = client;
                const { scenario } = game;
                if (!scenario) {
                    throw new Error(`No scenario selected`);
                }

                client.sideId = newSideId;

                game.broadcastMessage({
                    type: "lobby:client:side:changed",
                    payload: {
                        old: !oldSideId
                            ? undefined
                            : {
                                  sideId: oldSideId,
                                  sideName: scenario.getSide(oldSideId).name
                              },
                        new: !newSideId
                            ? undefined
                            : {
                                  sideId: newSideId,
                                  sideName: scenario.getSide(newSideId).name
                              }
                    }
                });
                game.broadcastMessage({
                    type: "lobby:state",
                    payload: this._buildLobbyState()
                });
            }
        );
        messageManager.registerHandler("client:ready", ({ game }, { ready }, { id: clientId }) => {
            const client = this.game.getClient(clientId);
            if (!client.sideId) {
                console.error(
                    `Client ${clientId} cannot be ready as it doesn't have a side assigned`
                );
                return;
            }
            client.ready = ready;

            game.broadcastMessage({
                type: "lobby:client:ready",
                payload: {
                    client: {
                        id: clientId,
                        name: game.getClient(clientId).name
                    },
                    ready
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
        messageManager.unregisterHandler("client:side:change");
        messageManager.unregisterHandler("client:ready");
    }

    clientConnected(client: Client): void {
        console.info(`LOBBY: *** Client '${client.name}' (${client.id}) connected ***`);

        // Tell everyone else we have a new client.
        this.game.broadcastMessage(
            {
                type: "client:connected",
                payload: {
                    clientId: client.id,
                    name: client.name
                }
            },
            client.id
        );

        // Tell everyone about the updated lobby state.
        this.game.broadcastMessage({
            type: "lobby:state",
            payload: this._buildLobbyState()
        });
    }

    clientDisconnected(client: Client): void {
        console.info(`LOBBY: *** Client '${client.name}' (${client.id}) disconnected ***`);

        this.game.broadcastMessage({
            type: "client:disconnected",
            payload: {
                clientId: client.id,
                name: client.name
            }
        });
        this.game.broadcastMessage({
            type: "lobby:state",
            payload: this._buildLobbyState(client.id)
        });
    }

    private _buildLobbyState(excludeId?: ClientId): LobbyState {
        const { clients } = this.game;

        return {
            ownerId: this.game.ownerId,
            clients: clients
                .filter(({ id: clientId }) => clientId != excludeId)
                .map((client) => ({
                    id: client.id,
                    name: client.name,
                    sideId: client.sideId,
                    ready: client.ready
                })),
            ...(this.game.scenario && { scenario: this.game.scenario?.toScenarioSummary() })
        };
    }
}
