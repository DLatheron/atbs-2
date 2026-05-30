import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager } from "../Game.js";

export class ArmamentPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.Enum.armament;
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        this._handlerHandles = [
            messageManager.registerHandler("client:armament:end", ({ game }) => {
                game.phase = Phase.enum.deployment;

                game.broadcastMessage({
                    type: "server:phase",
                    payload: { phase: Phase.Enum.armament }
                });
            })
        ];
    }
}
