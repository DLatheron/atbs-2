import { Description, SideId, SideSummary } from "@atbs/shared-data";
import z from "zod";
import { UnitRecipe } from "./Unit.js";

export const SideRecipe = z.object({
    id: SideId,
    name: z.string().min(1),
    description: Description,
    units: z.array(UnitRecipe),
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
    private readonly _recipe: SideRecipe;
    private _victoryPoints: number;

    constructor(recipe: SideRecipe) {
        this._recipe = recipe;
        this._victoryPoints = 0;
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

    get victoryPoints(): number {
        return this._victoryPoints;
    }

    get needsArmamentPhase(): boolean {
        return this._recipe.phases.armament.type === "manual";
    }

    get needsDeploymentPhase(): boolean {
        return this._recipe.phases.deployment.type === "manual";
    }

    toSummary(): SideSummary {
        return {
            id: this.id,
            name: this.name,
            victoryPoints: this.victoryPoints
        };
    }
}
