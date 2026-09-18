import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager } from "../Game.js";

/** Terminal phase after a side reaches the victory threshold. */
export class GameOverPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.enum.game_over;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    registerMessageHandlers(_messageManager: ClientMessageManager): void {
        // No gameplay messages accepted after the match ends.
    }

    async initialise(): Promise<void> {
        this.game.broadcastMessage({
            type: "server:phase",
            payload: { phase: Phase.enum.game_over }
        });
    }
}
