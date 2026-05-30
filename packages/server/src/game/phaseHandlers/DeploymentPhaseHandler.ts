import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager } from "../Game.js";

export class DeploymentPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.Enum.deployment;
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        this._handlerHandles = [
            messageManager.registerHandler("client:deployment:end", ({ game }) => {
                game.phase = Phase.enum.turns;

                game.broadcastMessage({
                    type: "server:phase",
                    payload: { phase: Phase.Enum.turns }
                });
            })
        ];
    }
}
