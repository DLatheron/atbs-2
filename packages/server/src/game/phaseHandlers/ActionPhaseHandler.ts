import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import { ClientMessageManager } from "../Game.js";
// import type { ClientMessageManager } from "../Game.js";

export class ActionPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.enum.action;
    }

    // TODO: Need to set just the first side off playing - other side should be hidden (and not receive any updates).

    async initialise() {
        this.game.startActionPhase();
        this.game.startTurn();

        // this.game.broadcastMessage({
        //     type: "server:unit",
        //     payload: {
        //         id: "captain-smith.unit"
        //     }
        // });
        // this.game.broadcastMessage({
        //     type: "server:map",
        //     payload: this.game.worldMap.renderClientMap()
        // });
        this.game.broadcastMessage({
            type: "server:phase",
            payload: { phase: Phase.enum.action }
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
            }),
            messageManager.registerHandler("client:game:turn:end", ({ game }, _payload, from) => {
                const playingClient = this.game.clients.find(
                    ({ sideId }) => this.game.turnsSide.id === sideId
                );
                if (!playingClient) {
                    throw new Error("Didn't find expected client");
                }

                if (from.id === playingClient.id) {
                    game.nextSide();
                }
            })
        ];
    }
}
