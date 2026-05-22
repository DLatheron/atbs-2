import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";

export class LobbyPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.Values.lobby;
    }

    get acceptingClients(): boolean {
        return true; // Potentially limit the maximum number of clients that can join the lobby.
    }
}
