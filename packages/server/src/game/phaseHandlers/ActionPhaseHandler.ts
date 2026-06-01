import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
// import type { ClientMessageManager } from "../Game.js";

export class ActionPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.enum.action;
    }

    async initialise() {
        this.game.broadcastMessage({
            type: "server:phase",
            payload: { phase: Phase.enum.action }
        });
        this.game.broadcastMessage({
            type: "server:wait",
            payload: null
        });
    }

    registerMessageHandlers(/*_messageManager: ClientMessageManager*/): void {}
}
