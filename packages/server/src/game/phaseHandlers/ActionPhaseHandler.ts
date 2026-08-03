import { Phase } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import { ClientMessageManager } from "../Game.js";
import { TilePos, Vec2 } from "@atbs/maths";

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
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        this._handlerHandles = [
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

                console.log(unit?.side.id, from.sideId);

                if (unit && unit.isAlive && unit.side.id === from.sideId) {
                    game.selectedUnit = unit;

                    from.sendMessage({
                        type: "server:camera:move:to",
                        payload: {
                            target: "tile",
                            tilePos: unit.mapLocation,
                            trackingSpeed: 1
                        }
                    });
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
                        selectedUnit.move(orientation);

                        if (!game.opportunityFireManager.startOpportunityFire()) {
                            from.sendMessage({ type: "server:ui:disabled", payload: false });
                        }
                    }
                }
            ),

            messageManager.registerHandler(
                "client:unit:rotate",
                ({ game }, { unitId, orientation }, from) => {
                    if (game.opportunityFireManager.opportunity) {
                        game.verifyFromOpportunityFireClient(from);
                    } else {
                        game.verifyFromPlayingClient(from);
                    }

                    const unit = game.getUnit(unitId);
                    if (unitId === unit?.id) {
                        unit.rotate(orientation);
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
                    if (game.opportunityFireManager.opportunity) {
                        game.verifyFromOpportunityFireClient(from);
                    } else {
                        game.verifyFromPlayingClient(from);
                    }

                    const unit = game.getUnit(unitId);
                    if (unitId !== unit?.id) {
                        throw new Error(`Unit ${unitId} is not selected`);
                    }

                    const item = unit.itemInUse;
                    if (!item) {
                        throw new Error(`Unit ${unitId} is not using an item`);
                    }

                    const weaponItem = item.getByItemId(weaponId);

                    weaponItem.fireSelector = fireSelector;

                    // TODO: Could be a delta update...
                    from.sendMessage({
                        type: "server:unit:mode:fire",
                        payload: unit?.itemInUse?.getFireModeItemSummary(unit) ?? null
                    });
                }
            ),

            messageManager.registerHandler("client:unit:fire", ({ game }, fireDetails, from) => {
                if (game.opportunityFireManager.opportunity) {
                    game.verifyFromOpportunityFireClient(from);
                } else {
                    game.verifyFromPlayingClient(from);
                }

                const unit = game.getUnit(fireDetails.unitId);
                const weapon = unit.itemInUse?.findByItemId(fireDetails.weaponId);
                if (!weapon) {
                    throw new Error(
                        `Unit ${unit.id} does not have weapon ${fireDetails.weaponId} in use`
                    );
                }

                unit.fire(
                    weapon,
                    fireDetails.fireSelector,
                    fireDetails.fireMode,
                    fireDetails.worldPoses.map((worldPos) => new Vec2(worldPos)),
                    fireDetails.triggerHeldTimeInMs
                );
                from.sendMessage({ type: "server:ui:disabled", payload: false });
            }),

            messageManager.registerHandler("client:unit:mode:fire:end", ({ game }, _null, from) => {
                if (game.opportunityFireManager.opportunity) {
                    game.verifyFromOpportunityFireClient(from);
                } else {
                    game.verifyFromPlayingClient(from);
                }

                if (!game.opportunityFireManager.continueOpportunityFire()) {
                    from.sendMessage({ type: "server:unit:mode:fire:end", payload: null });
                }
            }),

            messageManager.registerHandler(
                "client:unit:throw",
                ({ game }, { unitId, itemId, worldPos }, from) => {
                    if (game.opportunityFireManager.opportunity) {
                        game.verifyFromOpportunityFireClient(from);
                    } else {
                        game.verifyFromPlayingClient(from);
                    }

                    const unit = game.getUnit(unitId);
                    if (unitId !== unit?.id) {
                        throw new Error(`Unit ${unitId} is not selected`);
                    }

                    if (unit.itemInUse?.id !== itemId) {
                        throw new Error(`Unit ${unit.id} is not using item ${itemId}`);
                    }

                    unit.throw(new Vec2(worldPos));
                    from.sendMessage({ type: "server:ui:disabled", payload: false });
                }
            ),

            messageManager.registerHandler("client:game:unit:next", ({ game }, _null, from) => {
                game.verifyFromPlayingClient(from);
                const nextUnit = game.nextUnit();
                if (nextUnit) {
                    game.selectedUnit = nextUnit;
                    from.sendMessage({
                        type: "server:unit:mode:move",
                        payload: nextUnit.toSummary()
                    });
                }
            })
        ];
    }
}
