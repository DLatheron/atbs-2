import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager } from "../Game.js";

export class TurnPhaseHandler extends PhaseHandler {

    get phase(): Phase {
        return Phase.Enum.turns;
    }

    async initialise() {
        this.game.broadcastMessage({
            type: "server:phase",
            payload: { phase: Phase.Enum.turns }
        });
        this.game.broadcastMessage({
            type: "server:wait",
            payload: null
        });        
    }

    registerMessageHandlers(_messageManager: ClientMessageManager): void {
    }
}
