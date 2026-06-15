import { Description, SideId, SideSummary, UnitId } from "@atbs/shared-data";
import z from "zod";
import { Unit, UnitOverrides } from "./Unit.js";
import { UnitRecipeManager } from "./UnitRecipeManager.js";
import { ItemManager } from "./ItemManager.js";

export const SideRecipe = z.object({
    id: SideId,
    name: z.string().min(1),
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
                type: z.literal("manual")
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
    private readonly _units: Unit[];
    private readonly _unitMap: Map<UnitId, Unit>;
    private _victoryPoints: number;

    constructor(recipe: Readonly<SideRecipe>, itemManager: ItemManager) {
        this._recipe = recipe;
        this._victoryPoints = 0;

        this._units = [];
        this._unitMap = new Map<UnitId, Unit>();

        this._recipe.units.forEach(({ id, overrides }) => {
            const unit = UnitRecipeManager.GetSingleton().newUnit(
                id,
                overrides,
                { side: this },
                itemManager
            );

            this._units.push(unit);
            this._unitMap.set(unit.id, unit);
        });
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
