import { ClientId, LobbyState, Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager } from "../Game.js";
import { Client } from "../Client.js";

const autoSetupGame = true; // Temporary Hack.

export class LobbyPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.Enum.lobby;
    }

    get acceptingClients(): boolean {
        return true; // Potentially limit the maximum number of clients that can join the lobby.
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        this._handlerHandles = [
            messageManager.registerHandler("client:rename", ({ game }, payload, from) => {
                const { id: clientId } = from;
                const { name } = payload;
                const client = game.getClient(clientId);
                const { name: oldName } = client;

                if (oldName === name) {
                    return;
                }

                client.name = name;

                game.broadcastMessage({
                    type: "server:lobby:client:renamed",
                    payload: {
                        oldName,
                        newName: name
                    }
                });
                game.broadcastMessage({
                    type: "server:lobby:state",
                    payload: this._buildLobbyState()
                });
            }),
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
                        type: "server:lobby:client:side:changed",
                        payload: {
                            client: {
                                id: client.id,
                                name: client.name
                            },
                            oldSide: !oldSideId
                                ? undefined
                                : {
                                      id: oldSideId,
                                      name: scenario.getSide(oldSideId).name
                                  },
                            newSide: !newSideId
                                ? undefined
                                : {
                                      id: newSideId,
                                      name: scenario.getSide(newSideId).name
                                  }
                        }
                    });
                    game.broadcastMessage({
                        type: "server:lobby:state",
                        payload: this._buildLobbyState()
                    });
                }
            ),
            messageManager.registerHandler(
                "client:ready",
                ({ game }, { ready }, { id: clientId }) => {
                    const client = this.game.getClient(clientId);
                    if (!client.sideId) {
                        console.error(
                            `Client ${clientId} cannot be ready as it doesn't have a side assigned`
                        );
                        return;
                    }
                    client.ready = ready;

                    game.broadcastMessage({
                        type: "server:lobby:client:ready",
                        payload: {
                            client: {
                                id: clientId,
                                name: game.getClient(clientId).name
                            },
                            ready
                        }
                    });
                    game.broadcastMessage({
                        type: "server:lobby:state",
                        payload: this._buildLobbyState()
                    });
                }
            ),
            messageManager.registerHandler(
                "client:scenario:change",
                ({ game }, { scenarioId }, { id: clientId }) => {
                    if (clientId !== game.ownerId) {
                        console.error(
                            `Client ${clientId} attempted to set the scenario when they weren't the owner ${game.ownerId}`
                        );
                        return;
                    }

                    const client = this.game.getClient(clientId);
                    const oldScenario = game.scenario;
                    const scenario = scenarioId ? game.scenarioManager.get(scenarioId) : null;
                    game.scenario = scenario;

                    game.broadcastMessage({
                        type: "server:lobby:scenario:changed",
                        payload: {
                            client: { id: client.id, name: client.name },
                            oldScenario: oldScenario
                                ? { id: oldScenario.id, name: oldScenario.name }
                                : undefined,
                            newScenario: scenario
                                ? { id: scenario.id, name: scenario.name }
                                : undefined
                        }
                    });
                    game.broadcastMessage({
                        type: "server:lobby:state",
                        payload: this._buildLobbyState()
                    });
                }
            )
        ];
    }

    clientConnected(client: Client): void {
        console.info(`LOBBY: *** Client '${client.name}' (${client.id}) connected ***`);

        const clientIsOwner = client.id === this.game.ownerId;

        // Tell everyone else we have a new client.
        this.game.broadcastMessage(
            {
                type: "server:client:connected",
                payload: {
                    client: {
                        id: client.id,
                        name: client.name
                    }
                }
            },
            client.id
        );

        // Tell everyone about the updated lobby state.
        this.game.broadcastMessage({
            type: "server:lobby:state",
            payload: this._buildLobbyState()
        });

        if (clientIsOwner) {
            this.game.sendMessage(
                {
                    type: "server:lobby:scenario:list",
                    payload: {
                        scenarios: this.game.scenarioManager.toScenarioSummaries()
                    }
                },
                client.id
            );
        }

        //
        // Temporary Hack: Scenario loading is non-fatal.
        //
        if (autoSetupGame) {
            const scenarioId = "test-scenario";
            const scenario = this.game.scenarioManager.get(scenarioId);
            const { sides } = scenario;

            if (clientIsOwner) {
                this.game.queueMessage(
                    {
                        type: "client:scenario:change",
                        payload: { scenarioId }
                    },
                    client
                );
            }

            this.game.queueMessage(
                {
                    type: "client:side:change",
                    payload: { clientId: client.id, sideId: sides[clientIsOwner ? 0 : 1].id }
                },
                client
            );
            this.game.queueMessage(
                {
                    type: "client:ready",
                    payload: { ready: true }
                },
                client
            );
        }
    }

    clientDisconnected(client: Client): void {
        console.info(`LOBBY: *** Client '${client.name}' (${client.id}) disconnected ***`);

        this.game.broadcastMessage({
            type: "server:client:disconnected",
            payload: {
                client: {
                    id: client.id,
                    name: client.name
                }
            }
        });
        this.game.broadcastMessage({
            type: "server:lobby:state",
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
