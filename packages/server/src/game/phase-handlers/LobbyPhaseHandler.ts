import { LobbyState, Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager } from "../Game.js";
import { Client } from "../Client.js";

export class LobbyPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.Values.lobby;
    }

    get acceptingClients(): boolean {
        return true; // Potentially limit the maximum number of clients that can join the lobby.
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        messageManager.registerHandler("client:rename", () => {
            // console.dir({ handler: "client:rename", context, payload, from });
        });
    }

    unregisterMessageHandlers(messageManager: ClientMessageManager): void {
        messageManager.unregisterHandler("client:rename");
    }

    clientConnected(client: Client): void {
        console.info(`LOBBY: *** Client '${client.name}' (${client.clientId}) connected ***`);

        const lobbyState = this._buildLobbyState();

        // Give the current state to the recently connected client.
        this.game.sendMessage(
            {
                type: "lobby:state",
                payload: lobbyState
            },
            client.clientId
        );

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
    }

    clientDisconnected(client: Client): void {
        console.info(`LOBBY: *** Client '${client.name}' (${client.clientId}) disconnected ***`);
    }

    private _buildLobbyState(): LobbyState {
        const { clients } = this.game;

        return {
            ownerId: this.game.ownerId,
            clients: clients.map((client) => ({
                id: client.clientId,
                name: client.name,
                ready: false
            }))
        };
    }
}
