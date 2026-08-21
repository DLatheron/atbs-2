import { ErrorType, Phase, SideId, UnitId, WaitingFor } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager, Game } from "../Game.js";
import type { Client } from "../Client.js";
import type { Unit } from "../Unit.js";
import type { Side } from "../Side.js";

export class ArmamentPhaseHandler extends PhaseHandler {
    private readonly _armingSideIds: SideId[];
    private readonly _waitingSideIds: SideId[];

    get phase(): Phase {
        return Phase.enum.armament;
    }

    constructor(game: Game) {
        super(game);

        if (!game.needsArmamentPhase) {
            throw new Error(`Game ${game.id} does not need an armament phase`);
        }

        this._armingSideIds = [];
        this._waitingSideIds = [];

        for (const side of game.sides) {
            if (side.needsArmamentPhase) {
                this._armingSideIds.push(side.id);
            } else {
                this._waitingSideIds.push(side.id);
            }
        }
    }

    async initialise() {
        this.game.broadcastMessage({
            type: "server:phase",
            payload: { phase: Phase.enum.armament }
        });

        for (const side of this.game.sides) {
            if (!side.needsArmamentPhase) {
                continue;
            }
            const client = this.game.clients.find((entry) => entry.sideId === side.id);
            if (!client) {
                continue;
            }
            client.sendMessage({
                type: "server:armament:state",
                payload: this._armamentState(side)
            });
        }

        this.sendWaitMessageToWaitingClient();
    }

    sideIdCompleted(clientSideId: SideId) {
        const index = this._armingSideIds.findIndex((sideId) => sideId === clientSideId);
        if (index >= 0) {
            this._armingSideIds.splice(index, 1);
        }

        this._waitingSideIds.push(clientSideId);

        this.sendWaitMessageToWaitingClient();
    }

    sendWaitMessageToWaitingClient() {
        const waitingFor: WaitingFor = {
            phase: this.phase,
            sides: this._armingSideIds.map((sideId) => this.game.getSide(sideId).toSummary())
        };

        for (const client of this.game.clients) {
            const { sideId } = client;

            if (sideId && this._waitingSideIds.includes(sideId)) {
                client.sendMessage({ type: "server:wait", payload: waitingFor });
            } else {
                client.sendMessage({ type: "server:wait", payload: null });
            }
        }
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        this._handlerHandles = [
            messageManager.registerHandler(
                "client:armament:end",
                async ({ game }, _payload, client) => {
                    const { sideId: clientSideId } = client;
                    if (!clientSideId) {
                        throw new Error("Client does not have a set side ID");
                    }

                    this.sideIdCompleted(clientSideId);

                    if (this._armingSideIds.length === 0) {
                        await game.nextPhase();
                    }
                }
            ),
            messageManager.registerHandler("client:armament:buy", (_ctx, payload, client) => {
                const { unit, side } = this._requireArmingUnit(client, payload.unitId);
                const result = unit.armingBuyItem(side.store, payload.itemId, {
                    use: payload.use,
                    insertionPoint: payload.insertionPoint
                });
                this._sendArmingResult(client, unit, side, result);
            }),
            messageManager.registerHandler("client:armament:sell", (_ctx, payload, client) => {
                const { unit, side } = this._requireArmingUnit(client, payload.unitId);
                unit.armingSellItem(side.store, payload.itemId, payload.quantity);
                this._sendArmamentUpdate(client, unit, side);
            }),
            messageManager.registerHandler("client:armament:load", (_ctx, payload, client) => {
                const { unit, side } = this._requireArmingUnit(client, payload.unitId);
                unit.armingLoadItem(side.store, payload.receiverId, payload.ammoId);
                this._sendArmamentUpdate(client, unit, side);
            }),
            messageManager.registerHandler("client:armament:unload", (_ctx, payload, client) => {
                const { unit, side } = this._requireArmingUnit(client, payload.unitId);
                unit.armingUnloadItem(payload.itemId);
                this._sendArmamentUpdate(client, unit, side);
            }),
            messageManager.registerHandler("client:armament:use", (_ctx, payload, client) => {
                const { unit, side } = this._requireArmingUnit(client, payload.unitId);
                unit.armingUseItem(payload.itemId);
                this._sendArmamentUpdate(client, unit, side);
            }),
            messageManager.registerHandler("client:armament:unuse", (_ctx, payload, client) => {
                const { unit, side } = this._requireArmingUnit(client, payload.unitId);
                unit.armingUnuseItem();
                this._sendArmamentUpdate(client, unit, side);
            }),
            messageManager.registerHandler("client:armament:reorder", (_ctx, payload, client) => {
                const { unit, side } = this._requireArmingUnit(client, payload.unitId);
                unit.reorderInventory(payload.fromIndex, payload.toIndex);
                this._sendArmamentUpdate(client, unit, side);
            })
        ];
    }

    private _requireArmingUnit(client: Client, unitId: UnitId): { unit: Unit; side: Side } {
        const { sideId } = client;
        if (!sideId) {
            throw new Error("Client does not have a set side ID");
        }
        if (!this._armingSideIds.includes(sideId)) {
            throw new Error(`Side ${sideId} is not currently arming`);
        }

        const side = this.game.getSide(sideId);
        return { unit: side.getUnit(unitId), side };
    }

    private _sendArmingResult(client: Client, unit: Unit, side: Side, result: true | ErrorType) {
        if (result !== true) {
            client.sendMessage({ type: "server:error", payload: result });
            return;
        }
        this._sendArmamentUpdate(client, unit, side);
    }

    private _sendArmamentUpdate(client: Client, unit: Unit, side: Side) {
        client.sendMessage({
            type: "server:armament:update",
            payload: {
                unitId: unit.id,
                inventory: unit.toArmamentInventorySnapshot(),
                store: side.store.toSnapshot(),
                unit: unit.toSummary()
            }
        });
    }

    private _armamentState(side: Side) {
        return {
            units: side.units.map((unit) => unit.toSummary()),
            store: side.store.toSnapshot(),
            inventories: side.units.map((unit) => unit.toArmamentInventorySnapshot())
        };
    }
}
