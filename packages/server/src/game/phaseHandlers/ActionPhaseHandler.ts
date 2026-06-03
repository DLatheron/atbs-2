import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import { ClientMessageManager } from "../Game.js";
// import type { ClientMessageManager } from "../Game.js";

export class ActionPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.enum.action;
    }

    async initialise() {
        this.game.broadcastMessage({
            type: "server:unit",
            payload: {
                id: "captain-smith.unit"
            }
        });
        this.game.broadcastMessage({
            type: "server:map",
            payload: this.game.worldMap.renderClientMap()
        });
        this.game.broadcastMessage({
            type: "server:phase",
            payload: { phase: Phase.enum.action }
        });
        this.game.broadcastMessage({
            type: "server:wait",
            payload: null
        });
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        this._handlerHandles = [
            messageManager.registerHandler("client:game:refresh", (_context, _payload, from) => {
                from.sendMessage({
                    type: "server:unit",
                    payload: {
                        id: "captain-smith.unit"
                    }
                });
                from.sendMessage({
                    type: "server:map",
                    payload: this.game.worldMap.renderClientMap()
                });
            })
        ];
    }
}
