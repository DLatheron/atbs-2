import { Description, SideId, SideSummary, UnitId } from "@atbs/shared-data";
import z from "zod";
import { Unit, UnitOverrides } from "./Unit.js";
import { UnitRecipeManager } from "./UnitRecipeManager.js";
import type { Game } from "./Game.js";
import { VisibilityPoi } from "./VisibilityPoi.js";
import { InventoryRecipe } from "./Inventory.js";
import { Store, StoreRecipe } from "./Store.js";

export const SideRecipe = z.object({
    id: SideId,
    name: z.string().nonempty(),
    description: Description,
    oppositionSideIds: z.array(SideId),
    units: z.array(
        z.object({
            id: UnitId,
            overrides: UnitOverrides
        })
    ),
    phases: z.object({
        armament: z.discriminatedUnion("type", [
            z.object({
                type: z.literal("fixed")
            }),
            z.object({
                type: z.literal("manual"),
                store: StoreRecipe,
                startingInventory: z.record(UnitId, InventoryRecipe).optional()
            })
        ]),
        deployment: z.discriminatedUnion("type", [
            z.object({
                type: z.literal("fixed")
            }),
            z.object({
                type: z.literal("manual")
            })
        ])
    })
});
export type SideRecipe = z.infer<typeof SideRecipe>;

export class Side {
    private readonly _recipe: Readonly<SideRecipe>;
    private readonly _game: Game;
    private readonly _units: Unit[];
    private readonly _unitMap: Map<UnitId, Unit>;
    private _victoryPoints: number;
    private readonly _store: Store | null;

    constructor(recipe: Readonly<SideRecipe>, game: Game) {
        this._recipe = recipe;
        this._game = game;
        this._victoryPoints = 0;

        this._units = [];
        this._unitMap = new Map<UnitId, Unit>();

        this._recipe.units.forEach(({ id, overrides }) => {
            const unit = UnitRecipeManager.GetSingleton().newUnit(
                id,
                overrides,
                { side: this },
                this._game
            );

            this._units.push(unit);
            this._unitMap.set(unit.id, unit);
        });

        const { armament } = this._recipe.phases;
        if (armament.type === "manual") {
            this._store = new Store(armament.store, game.itemManager);
            for (const unit of this._units) {
                const starting = armament.startingInventory?.[unit.id];
                unit.resetInventory(starting ?? { inUse: null, items: [] });
            }
        } else {
            this._store = null;
        }
    }

    get id(): SideId {
        return this._recipe.id;
    }

    get name(): string {
        return this._recipe.name;
    }

    get description(): Description {
        return this._recipe.description;
    }

    get oppositionSideIds(): SideId[] {
        return this._recipe.oppositionSideIds;
    }

    get victoryPoints(): number {
        return this._victoryPoints;
    }

    get needsArmamentPhase(): boolean {
        return this._recipe.phases.armament.type === "manual";
    }

    get store(): Store {
        if (!this._store) {
            throw new Error(`Side ${this.id} does not have a store`);
        }
        return this._store;
    }

    findStore(): Store | null {
        return this._store;
    }

    get needsDeploymentPhase(): boolean {
        return this._recipe.phases.deployment.type === "manual";
    }

    get units(): Unit[] {
        return this._units;
    }

    get hasAliveUnits(): boolean {
        return this._units.some((unit) => unit.isAlive);
    }

    get allUnitsDead(): boolean {
        return this._units.every((unit) => unit.isDead);
    }

    canSee(poi: VisibilityPoi): boolean {
        return this._game.visibilityManager.isPoiVisibleForMasks(poi, [this.id]);
    }

    findUnit(unitId: UnitId): Unit | undefined {
        return this._unitMap.get(unitId);
    }

    getUnit(unitId: UnitId): Unit {
        const unit = this.findUnit(unitId);
        if (!unit) {
            throw new Error(`Unit ${unitId} not found`);
        }
        return unit;
    }

    toSummary(): SideSummary {
        return {
            id: this.id,
            name: this.name,
            victoryPoints: this.victoryPoints
        };
    }
}
