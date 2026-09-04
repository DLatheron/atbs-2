import { clamp } from "@atbs/maths";
import { ItemId, UnitId } from "@atbs/shared-data";
import z from "zod";
import type { GameEvents } from "./EventManager.js";
import type { Game } from "./Game.js";
import type { Item } from "./Item.js";
import type { Side } from "./Side.js";
import type { Unit } from "./Unit.js";

export const VictoryPointsPerAction = z
    .number()
    .int()
    .min(1)
    .max(100)
    .or(z.literal("immediate-loss"))
    .or(z.literal("immediate-win"))
    .describe("Victory points awarded for the action, or an immediate win/loss outcome.");
export type VictoryPointsPerAction = z.infer<typeof VictoryPointsPerAction>;

/** Extra fields required per GameEvents entry (beyond action + victoryPoints). */
export const UnitKilledVictoryAction = z.object({
    action: z.literal("unitKilled" satisfies keyof GameEvents),
    unitId: UnitId.describe("The unit recipe id that must be killed."),
    victoryPoints: VictoryPointsPerAction
});
export type UnitKilledVictoryAction = z.infer<typeof UnitKilledVictoryAction>;

export const ItemDroppedVictoryAction = z.object({
    action: z.literal("itemDropped" satisfies keyof GameEvents),
    itemId: ItemId.describe("The item recipe id that must be dropped."),
    victoryPoints: VictoryPointsPerAction
});
export type ItemDroppedVictoryAction = z.infer<typeof ItemDroppedVictoryAction>;

export const VictoryAction = z.discriminatedUnion("action", [
    UnitKilledVictoryAction,
    ItemDroppedVictoryAction
]);
export type VictoryAction = z.infer<typeof VictoryAction>;

/** Ensures every GameEvents key has a corresponding VictoryAction variant. */
type AssertAllGameEventsHaveVictoryActions = {
    [K in keyof GameEvents]: Extract<VictoryAction, { action: K }>;
};
type _MissingVictoryActionEvents = {
    [K in keyof AssertAllGameEventsHaveVictoryActions]: AssertAllGameEventsHaveVictoryActions[K] extends never
        ? K
        : never;
}[keyof AssertAllGameEventsHaveVictoryActions];
type _AssertNoMissingVictoryActions = [_MissingVictoryActionEvents] extends [never]
    ? true
    : `Missing VictoryAction schema for: ${_MissingVictoryActionEvents}`;
const _assertAllGameEventsHaveVictoryActions: _AssertNoMissingVictoryActions = true;
void _assertAllGameEventsHaveVictoryActions;

export const VictoryActions = z
    .array(VictoryAction)
    .describe("Actions that award victory points for this side. May be empty.");
export type VictoryActions = z.infer<typeof VictoryActions>;

export const VICTORY_POINTS_MIN = -100;
export const VICTORY_POINTS_MAX = 100;
export const VICTORY_POINTS_IMMEDIATE_LOSS = -200;
export const VICTORY_POINTS_IMMEDIATE_WIN = 200;

export class VictoryPointManager {
    private readonly _side: Side;
    private readonly _victoryActions: VictoryActions;

    private _victoryPoints: number;

    constructor(side: Side, victoryActions: VictoryActions, initialVictoryPoints: number) {
        this._side = side;
        this._victoryActions = victoryActions;
        this._victoryPoints = initialVictoryPoints;

        this._registerVictoryActions();
    }

    get isImmediateLoss(): boolean {
        return this._victoryPoints === VICTORY_POINTS_IMMEDIATE_LOSS;
    }

    get isImmediateWin(): boolean {
        return this._victoryPoints === VICTORY_POINTS_IMMEDIATE_WIN;
    }

    get victoryPoints(): number {
        return clamp(this._victoryPoints, -100, 100);
    }

    get victoryActions(): VictoryActions {
        return this._victoryActions;
    }

    set victoryPoints(value: number) {
        this._victoryPoints = value;
    }

    get side(): Side {
        return this._side;
    }

    get game(): Game {
        return this._side.game;
    }

    private _registerVictoryActions(): void {
        const { game } = this.side;

        game.eventManager.register("unitKilled", (_unit: Unit) => {
            const victoryAction = this._findVictoryAction("unitKilled");
            if (victoryAction && victoryAction.unitId === _unit.id) {
                this._applyVictoryPoints(victoryAction);
            }
        });
        game.eventManager.register("itemDropped", (_item: Item) => {
            const victoryAction = this._findVictoryAction("itemDropped");
            if (victoryAction && victoryAction.itemId === _item.id) {
                this._applyVictoryPoints(victoryAction);
            }
        });
    }

    private _findVictoryAction<K extends keyof GameEvents>(
        action: K
    ): Extract<VictoryAction, { action: K }> | undefined {
        return this._victoryActions.find(
            (candidate): candidate is Extract<VictoryAction, { action: K }> =>
                candidate.action === action
        );
    }

    private _applyVictoryPoints(action: VictoryAction): void {
        const { victoryPoints } = action;
        if (victoryPoints === "immediate-loss") {
            this.victoryPoints = VICTORY_POINTS_IMMEDIATE_LOSS;
        } else if (victoryPoints === "immediate-win") {
            this.victoryPoints = VICTORY_POINTS_IMMEDIATE_WIN;
        } else {
            this.victoryPoints += victoryPoints;
        }

        this.game.broadcastMessage({
            type: "server:side:victory-points",
            payload: {
                sideId: this.side.id,
                victoryPoints: this.victoryPoints
            }
        });
    }
}
