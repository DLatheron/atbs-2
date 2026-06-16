import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import { ClientMessageManager } from "../Game.js";
import { TilePos } from "@atbs/maths";
// import type { ClientMessageManager } from "../Game.js";

export class ActionPhaseHandler extends PhaseHandler {
    get phase(): Phase {
        return Phase.enum.action;
    }

    // TODO: Need to set just the first side off playing - other side should be hidden (and not receive any updates).

    async initialise() {
        this.messageRouter.broadcast({
            type: "server:phase",
            payload: { phase: Phase.enum.action }
        });

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
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        this._handlerHandles = [
            // messageManager.registerHandler("client:game:refresh", (_context, _payload, from) => {
            //     from.sendMessage({
            //         type: "server:map",
            //         payload: this.game.worldMap.renderClientMap()
            //     });
            // }),

            messageManager.registerHandler("client:game:turn:end", ({ game }, _payload, from) => {
                game.verifyFromPlayingClient(from);
                game.nextSide();
            }),

            messageManager.registerHandler("client:game:tile:info", ({ game }, payload, from) => {
                const { map: worldMap } = game;
                const tilePos = new TilePos(payload.tilePos);
                const tile = worldMap.getTile(tilePos);

                from.sendMessage({
                    type: "server:game:tile:info",
                    payload: tile.getTileInfo()
                });
            }),

            messageManager.registerHandler("client:game:tile:click", ({ game }, payload, from) => {
                game.verifyFromPlayingClient(from);

                const { map: worldMap } = game;
                const tilePos = new TilePos(payload.tilePos);
                const tile = worldMap.getTile(tilePos);
                const unit = tile.topmostUnit;

                if (unit && unit.side.id === from.sideId) {
                    game.selectedUnit = unit;

                    from.sendMessage({
                        type: "server:unit:mode:move",
                        payload: unit.toSummary()
                    });
                }
            }),

            messageManager.registerHandler(
                "client:unit:move:end",
                ({ game }, selectedUnitId, from) => {
                    game.verifyFromPlayingClient(from);

                    const { selectedUnit } = game;
                    if (selectedUnitId === selectedUnit?.id) {
                        game.selectedUnit = null;
                        from.sendMessage({
                            type: "server:unit:mode:move",
                            payload: null
                        });
                    }
                }
            ),

            messageManager.registerHandler(
                "client:unit:move",
                ({ game }, { unitId, orientation }, from) => {
                    game.verifyFromPlayingClient(from);

                    const { selectedUnit } = game;
                    if (unitId === selectedUnit?.id) {
                        selectedUnit.move(game, orientation, game.messageRouter);
                        from.sendMessage({ type: "server:ui:disabled", payload: false });
                    }
                }
            ),

            messageManager.registerHandler(
                "client:unit:rotate",
                ({ game }, { unitId, orientation }, from) => {
                    game.verifyFromPlayingClient(from);

                    const { selectedUnit } = game;
                    if (unitId === selectedUnit?.id) {
                        selectedUnit.rotate(game, orientation, game.messageRouter);
                        from.sendMessage({ type: "server:ui:disabled", payload: false });
                    }
                }
            ),

            messageManager.registerHandler("client:unit:mode:fire", ({ game }, _null, from) => {
                game.verifyFromPlayingClient(from);
                const { selectedUnit } = game;
                from.sendMessage({
                    type: "server:unit:mode:fire",
                    payload: selectedUnit?.itemInUse?.getFireModeItemSummary(selectedUnit) ?? null
                });
            }),

            messageManager.registerHandler("client:unit:mode:throw", ({ game }, _null, from) => {
                game.verifyFromPlayingClient(from);
                const { selectedUnit } = game;
                from.sendMessage({
                    type: "server:unit:mode:throw",
                    payload: selectedUnit?.itemInUse?.getItemSummary() ?? null
                });
            })
        ];
    }
}
