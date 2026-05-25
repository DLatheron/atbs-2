import { Phase } from "@atbs/shared-data";
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
    }

    clientDisconnected(client: Client): void {
        console.info(`LOBBY: *** Client '${client.name}' (${client.clientId}) disconnected ***`);
    }
}
