import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import { ClientMessageManager } from "../Game.js";
import { Colour, TilePos, Vec2 } from "@atbs/maths";
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
                from.sendMessage({
                    type: "server:debug:graphics",
                    payload: {
                        tiles: [
                            {
                                tilePos,
                                fillColour: new Colour({ ...Colour.Green, a: 0.5 }),
                                strokeColour: Colour.Yellow,
                                strokeThickness: 1
                            }
                        ],
                        lines: [
                            {
                                srcWorldPos: game.map.tileOffsetToWorld(
                                    tilePos,
                                    new Vec2({ x: 0, y: 0 })
                                ),
                                dstWorldPos: game.map.tileOffsetToWorld(
                                    tilePos,
                                    new Vec2({ x: 100, y: 100 })
                                ),
                                strokeColour: Colour.White,
                                strokeThickness: 2
                            }
                        ]
                    }
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

            messageManager.registerHandler(
                "client:unit:fire:selector",
                ({ game }, { unitId, weaponId, fireSelector }, from) => {
                    game.verifyFromPlayingClient(from);
                    const { selectedUnit } = game;
                    if (unitId !== selectedUnit?.id) {
                        throw new Error(`Unit ${unitId} is not selected`);
                    }

                    const item = selectedUnit.itemInUse;
                    if (!item) {
                        throw new Error(`Unit ${unitId} is not using an item`);
                    }

                    const weaponItem = item.getByItemId(weaponId);

                    weaponItem.fireSelector = fireSelector;

                    // TODO: Could be a delta update...
                    from.sendMessage({
                        type: "server:unit:mode:fire",
                        payload:
                            selectedUnit?.itemInUse?.getFireModeItemSummary(selectedUnit) ?? null
                    });
                }
            ),

            messageManager.registerHandler("client:unit:fire", ({ game }, fireDetails, from) => {
                game.verifyFromPlayingClient(from);
                const { selectedUnit } = game;
                if (fireDetails.unitId !== selectedUnit?.id) {
                    throw new Error(`Unit ${fireDetails.unitId} is not selected`);
                }

                const weapon = selectedUnit.itemInUse?.findByItemId(fireDetails.weaponId);
                if (!weapon) {
                    throw new Error(
                        `Unit ${selectedUnit.id} does not have weapon ${fireDetails.weaponId} in use`
                    );
                }

                selectedUnit.fire(
                    game,
                    weapon,
                    fireDetails.fireSelector,
                    fireDetails.fireMode,
                    fireDetails.worldPoses.map((worldPos) => new Vec2(worldPos)),
                    fireDetails.triggerHeldTimeInMs,
                    this.messageRouter
                );
                from.sendMessage({ type: "server:ui:disabled", payload: false });
            }),

            messageManager.registerHandler("client:unit:throw", ({ game }, throwDetails, from) => {
                game.verifyFromPlayingClient(from);
                const { selectedUnit } = game;
                if (throwDetails.unitId !== selectedUnit?.id) {
                    throw new Error(`Unit ${throwDetails.unitId} is not selected`);
                }

                if (selectedUnit.itemInUse?.id !== throwDetails.itemId) {
                    throw new Error(
                        `Unit ${selectedUnit.id} is not using item ${throwDetails.itemId}`
                    );
                }

                selectedUnit.throw(game, new Vec2(throwDetails.worldPos), this.messageRouter);
                from.sendMessage({ type: "server:ui:disabled", payload: false });
            })
        ];
    }
}
