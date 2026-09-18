import { clamp } from "@atbs/maths";
import {
    FurnitureId,
    ItemId,
    SideId,
    UnitId,
    type VictoryObjectiveSummary
} from "@atbs/shared-data";
import z from "zod";
import type { Game } from "./Game.js";
import type { Side } from "./Side.js";
import type { Unit } from "./Unit.js";
import type { Item } from "./Item.js";
import type { Furniture } from "./Furniture.js";
import { UnitRecipeManager } from "./UnitRecipeManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";

export const VictoryValue = z
    .number()
    .int()
    .min(1)
    .max(100)
    .or(z.literal("immediate-loss"))
    .or(z.literal("immediate-win"))
    .describe("Victory points granted per successful match, or an immediate win/loss outcome.");
export type VictoryValue = z.infer<typeof VictoryValue>;

export const VictoryTrigger = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("unitKilled"),
        unitId: UnitId.optional(),
        sideId: SideId.optional(),
        oppositionOnly: z
            .boolean()
            .optional()
            .describe("When true, only kills of opposition-side units match.")
    }),
    z.object({
        type: z.literal("sideEliminated"),
        sideId: SideId
    }),
    z.object({
        type: z.literal("furnitureDestroyed"),
        recipeId: FurnitureId.optional(),
        furnitureId: z.string().nonempty().optional()
    }),
    z.object({
        type: z.literal("furnitureAction"),
        action: z.string().nonempty(),
        recipeId: FurnitureId.optional(),
        requiredItemId: ItemId.optional()
    }),
    z.object({
        type: z.literal("itemDropped"),
        itemId: ItemId.optional()
    }),
    z.object({
        type: z.literal("itemPickedUp"),
        itemId: ItemId.optional()
    }),
    z.object({
        type: z.literal("unitEnteredZone"),
        zoneId: z.string().nonempty(),
        unitId: UnitId.optional(),
        sideId: SideId.optional()
    }),
    z.object({
        type: z.literal("itemEnteredZone"),
        zoneId: z.string().nonempty(),
        itemId: ItemId.optional()
    }),
    z.object({
        type: z.literal("turnEnded"),
        minTurn: z.number().int().positive()
    })
]);
export type VictoryTrigger = z.infer<typeof VictoryTrigger>;

export const VictoryAwardRule = z
    .object({
        id: z.string().nonempty().describe("Stable id for UI and progress tracking."),
        name: z
            .string()
            .nonempty()
            .optional()
            .describe("Optional display template with ${tokens} for the objectives list."),
        on: VictoryTrigger,
        value: VictoryValue,
        awards: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .default(0)
            .describe("How many times this rule has granted so far. Defaults to 0."),
        maxAwards: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Cap on how many times this rule can grant."),
        once: z
            .boolean()
            .optional()
            .describe("Shorthand for maxAwards: 1. Defaults to true when maxAwards is unset.")
    })
    .describe("An event-triggered rule that grants victory points for a side.");
export type VictoryAwardRule = z.infer<typeof VictoryAwardRule>;

export const VictoryRules = z
    .array(VictoryAwardRule)
    .default([])
    .describe("Award rules for this side. May be empty.");
export type VictoryRules = z.infer<typeof VictoryRules>;

/** @deprecated Use VictoryAwardRule / VictoryRules. Kept as alias during migration. */
export type VictoryCondition = VictoryAwardRule;
export const VictoryCondition = VictoryAwardRule;

export const VICTORY_POINTS_MIN = -100;
export const VICTORY_POINTS_MAX = 100;
export const VICTORY_POINTS_IMMEDIATE_LOSS = -200;
export const VICTORY_POINTS_IMMEDIATE_WIN = 200;

type RuntimeRule = {
    recipe: VictoryAwardRule;
    awards: number;
};

function effectiveMaxAwards(rule: VictoryAwardRule): number | undefined {
    if (rule.maxAwards != null) {
        return rule.maxAwards;
    }
    if (rule.once === false) {
        return undefined;
    }
    return 1;
}

export class VictoryPointManager {
    private readonly _side: Side;
    private readonly _rules: RuntimeRule[];
    private _victoryPoints: number;
    private _listenersRegistered = false;

    constructor(side: Side, victoryRules: VictoryRules, initialVictoryPoints: number) {
        this._side = side;
        this._rules = victoryRules.map((recipe) => ({
            recipe,
            awards: recipe.awards ?? 0
        }));
        this._victoryPoints = initialVictoryPoints;
    }

    /** Call once the side is attached to a live game with an EventManager. */
    registerListeners(sidesById?: ReadonlyMap<SideId, Side>): void {
        if (this._listenersRegistered) {
            return;
        }
        this._listenersRegistered = true;
        this._ensureDefaultRules(sidesById);
        this._registerListeners();
    }

    /**
     * When a side has no victoryRules, award points for each opposition kill
     * (attrition toward wiping the enemy — race to 100).
     */
    private _ensureDefaultRules(sidesById?: ReadonlyMap<SideId, Side>): void {
        if (this._rules.length > 0) {
            return;
        }

        const resolveSide = (sideId: SideId): Side | undefined => {
            const fromMap = sidesById?.get(sideId);
            if (fromMap) {
                return fromMap;
            }
            try {
                return this.game.getSide(sideId);
            } catch {
                return undefined;
            }
        };

        const oppositionUnitCount = this.side.oppositionSideIds.reduce((sum, sideId) => {
            return sum + (resolveSide(sideId)?.units.length ?? 0);
        }, 0);

        const maxAwards = Math.max(1, oppositionUnitCount);
        const value = Math.max(1, Math.min(VICTORY_POINTS_MAX, Math.ceil(100 / maxAwards)));

        const soleOppositionId =
            this.side.oppositionSideIds.length === 1 ? this.side.oppositionSideIds[0] : undefined;
        const oppositionName = soleOppositionId
            ? (resolveSide(soleOppositionId)?.name ?? "hostiles")
            : "hostiles";

        const recipe = VictoryAwardRule.parse({
            id: "default-eliminate-opposition",
            name: `Eliminate ${oppositionName} (\${awards} of \${maxAwards})`,
            on: { type: "unitKilled", oppositionOnly: true },
            value,
            maxAwards,
            once: false,
            awards: 0
        });

        this._rules.push({ recipe, awards: 0 });
    }

    get isImmediateLoss(): boolean {
        return this._victoryPoints === VICTORY_POINTS_IMMEDIATE_LOSS;
    }

    get isImmediateWin(): boolean {
        return this._victoryPoints === VICTORY_POINTS_IMMEDIATE_WIN;
    }

    get victoryPoints(): number {
        return clamp(this._victoryPoints, VICTORY_POINTS_MIN, VICTORY_POINTS_MAX);
    }

    get victoryRules(): VictoryAwardRule[] {
        return this._rules.map(({ recipe, awards }) => ({ ...recipe, awards }));
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

    toObjectiveSummaries(): VictoryObjectiveSummary[] {
        return this._rules
            .filter(({ recipe }) => recipe.name != null)
            .map(({ recipe, awards }) => {
                const maxAwards = effectiveMaxAwards(recipe);
                return {
                    id: recipe.id,
                    name: this.formatVictoryRuleName(recipe, awards),
                    awards,
                    ...(maxAwards != null ? { maxAwards } : {}),
                    value: recipe.value,
                    complete: maxAwards != null ? awards >= maxAwards : false
                };
            });
    }

    formatVictoryRuleName(rule: VictoryAwardRule, awards = rule.awards ?? 0): string {
        const template = rule.name;
        if (!template) {
            return "";
        }

        const maxAwards = effectiveMaxAwards(rule);
        const tokens: Record<string, string> = {
            awards: String(awards),
            maxAwards: maxAwards != null ? String(maxAwards) : "",
            value: String(rule.value),
            unit: this._resolveUnitName(rule.on),
            item: this._resolveItemName(rule.on),
            furniture: this._resolveFurnitureName(rule.on),
            side: this._resolveSideName(rule.on),
            zone: this._resolveZoneName(rule.on),
            action: this._resolveActionName(rule.on),
            minTurn: this._resolveMinTurn(rule.on)
        };

        return template.replace(/\$\{(\w+)\}/g, (_match, key: string) => tokens[key] ?? "");
    }

    private _registerListeners(): void {
        const types = new Set(this._rules.map(({ recipe }) => recipe.on.type));
        const { eventManager } = this.game;

        if (types.has("unitKilled")) {
            eventManager.register("unitKilled", (unit) => this._onUnitKilled(unit));
        }
        if (types.has("sideEliminated")) {
            eventManager.register("sideEliminated", (side) => this._onSideEliminated(side));
        }
        if (types.has("furnitureDestroyed")) {
            eventManager.register("furnitureDestroyed", (furniture) =>
                this._onFurnitureDestroyed(furniture)
            );
        }
        if (types.has("furnitureAction")) {
            eventManager.register("furnitureAction", (furniture, action, actor, itemUsed) =>
                this._onFurnitureAction(furniture, action, actor, itemUsed)
            );
        }
        if (types.has("itemDropped")) {
            eventManager.register("itemDropped", (item) => this._onItemDropped(item));
        }
        if (types.has("itemPickedUp")) {
            eventManager.register("itemPickedUp", (item) => this._onItemPickedUp(item));
        }
        if (types.has("unitEnteredZone")) {
            eventManager.register("unitEnteredZone", (unit, zoneId) =>
                this._onUnitEnteredZone(unit, zoneId)
            );
        }
        if (types.has("itemEnteredZone")) {
            eventManager.register("itemEnteredZone", (item, zoneId) =>
                this._onItemEnteredZone(item, zoneId)
            );
        }
        if (types.has("turnEnded")) {
            eventManager.register("turnEnded", (turnNumber) => this._onTurnEnded(turnNumber));
        }
    }

    private _onUnitKilled(unit: Unit): void {
        for (const runtime of this._matchingRules("unitKilled")) {
            const { on } = runtime.recipe;
            if (on.type !== "unitKilled") continue;
            if (on.unitId != null && on.unitId !== unit.id) continue;
            if (on.sideId != null && on.sideId !== unit.side.id) continue;
            if (on.oppositionOnly && !this.side.oppositionSideIds.includes(unit.side.id)) {
                continue;
            }
            this._grant(runtime);
        }
    }

    private _onSideEliminated(side: Side): void {
        for (const runtime of this._matchingRules("sideEliminated")) {
            const { on } = runtime.recipe;
            if (on.type !== "sideEliminated") continue;
            if (on.sideId !== side.id) continue;
            this._grant(runtime);
        }
    }

    private _onFurnitureDestroyed(furniture: Furniture): void {
        for (const runtime of this._matchingRules("furnitureDestroyed")) {
            const { on } = runtime.recipe;
            if (on.type !== "furnitureDestroyed") continue;
            if (on.recipeId != null && on.recipeId !== furniture.recipeId) continue;
            if (on.furnitureId != null && on.furnitureId !== furniture.id) continue;
            this._grant(runtime);
        }
    }

    private _onFurnitureAction(
        furniture: Furniture,
        action: string,
        _actor: Unit,
        itemUsed: Item | null
    ): void {
        for (const runtime of this._matchingRules("furnitureAction")) {
            const { on } = runtime.recipe;
            if (on.type !== "furnitureAction") continue;
            if (on.action !== action) continue;
            if (on.recipeId != null && on.recipeId !== furniture.recipeId) continue;
            if (on.requiredItemId != null && itemUsed?.recipeId !== on.requiredItemId) continue;
            this._grant(runtime);
        }
    }

    private _onItemDropped(item: Item): void {
        for (const runtime of this._matchingRules("itemDropped")) {
            const { on } = runtime.recipe;
            if (on.type !== "itemDropped") continue;
            if (on.itemId != null && on.itemId !== item.recipeId) continue;
            this._grant(runtime);
        }
    }

    private _onItemPickedUp(item: Item): void {
        for (const runtime of this._matchingRules("itemPickedUp")) {
            const { on } = runtime.recipe;
            if (on.type !== "itemPickedUp") continue;
            if (on.itemId != null && on.itemId !== item.recipeId) continue;
            this._grant(runtime);
        }
    }

    private _onUnitEnteredZone(unit: Unit, zoneId: string): void {
        for (const runtime of this._matchingRules("unitEnteredZone")) {
            const { on } = runtime.recipe;
            if (on.type !== "unitEnteredZone") continue;
            if (on.zoneId !== zoneId) continue;
            if (on.unitId != null && on.unitId !== unit.id) continue;
            if (on.sideId != null && on.sideId !== unit.side.id) continue;
            this._grant(runtime);
        }
    }

    private _onItemEnteredZone(item: Item, zoneId: string): void {
        for (const runtime of this._matchingRules("itemEnteredZone")) {
            const { on } = runtime.recipe;
            if (on.type !== "itemEnteredZone") continue;
            if (on.zoneId !== zoneId) continue;
            if (on.itemId != null && on.itemId !== item.recipeId) continue;
            this._grant(runtime);
        }
    }

    private _onTurnEnded(turnNumber: number): void {
        for (const runtime of this._matchingRules("turnEnded")) {
            const { on } = runtime.recipe;
            if (on.type !== "turnEnded") continue;
            if (turnNumber < on.minTurn) continue;
            this._grant(runtime);
        }
    }

    private _matchingRules(type: VictoryTrigger["type"]): RuntimeRule[] {
        return this._rules.filter(({ recipe, awards }) => {
            if (recipe.on.type !== type) {
                return false;
            }
            const max = effectiveMaxAwards(recipe);
            return max == null || awards < max;
        });
    }

    private _grant(runtime: RuntimeRule): void {
        const max = effectiveMaxAwards(runtime.recipe);
        if (max != null && runtime.awards >= max) {
            return;
        }

        runtime.awards += 1;

        const { value } = runtime.recipe;
        if (value === "immediate-loss") {
            this._victoryPoints = VICTORY_POINTS_IMMEDIATE_LOSS;
        } else if (value === "immediate-win") {
            this._victoryPoints = VICTORY_POINTS_IMMEDIATE_WIN;
        } else {
            this._victoryPoints += value;
        }

        this.game.notifyVictoryPointsChanged(this.side.id);
    }

    private _resolveUnitName(on: VictoryTrigger): string {
        const unitId = "unitId" in on ? on.unitId : undefined;
        if (!unitId) {
            return "";
        }
        let live;
        try {
            live = this.game.sides.flatMap((s) => s.units ?? []).find((unit) => unit.id === unitId);
        } catch {
            live = undefined;
        }
        if (live) {
            return live.name;
        }
        return UnitRecipeManager.GetSingleton().findRecipe(unitId)?.name ?? unitId;
    }

    private _resolveItemName(on: VictoryTrigger): string {
        let itemId: ItemId | undefined;
        if (
            on.type === "itemDropped" ||
            on.type === "itemPickedUp" ||
            on.type === "itemEnteredZone"
        ) {
            itemId = on.itemId;
        } else if (on.type === "furnitureAction") {
            itemId = on.requiredItemId;
        }
        if (!itemId) {
            return "";
        }
        return ItemRecipeManager.GetSingleton().findRecipe(itemId)?.name ?? itemId;
    }

    private _resolveFurnitureName(on: VictoryTrigger): string {
        const recipeId =
            on.type === "furnitureDestroyed" || on.type === "furnitureAction"
                ? on.recipeId
                : undefined;
        if (!recipeId) {
            return "";
        }
        return FurnitureRecipeManager.GetSingleton().findRecipe(recipeId)?.name ?? recipeId;
    }

    private _resolveSideName(on: VictoryTrigger): string {
        const sideId = "sideId" in on ? on.sideId : undefined;
        if (!sideId) {
            return "";
        }
        try {
            return this.game.getSide(sideId).name;
        } catch {
            return sideId;
        }
    }

    private _resolveZoneName(on: VictoryTrigger): string {
        const zoneId =
            on.type === "unitEnteredZone" || on.type === "itemEnteredZone" ? on.zoneId : undefined;
        if (!zoneId) {
            return "";
        }
        return this.game.getZoneName(zoneId);
    }

    private _resolveActionName(on: VictoryTrigger): string {
        return on.type === "furnitureAction" ? on.action : "";
    }

    private _resolveMinTurn(on: VictoryTrigger): string {
        return on.type === "turnEnded" ? String(on.minTurn) : "";
    }
}
