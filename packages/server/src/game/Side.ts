import { Description, SideId } from "@atbs/shared-data";
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

    constructor(recipe: SideRecipe) {
        this._recipe = recipe;
    }

    get id() {
        return this._recipe.id;
    }

    get name() {
        return this._recipe.name;
    }

    get description() {
        return this._recipe.description;
    }

    get needsArmamentPhase() {
        return this._recipe.phases.armament.type === "manual";
    }

    get needsDeploymentPhase() {
        return this._recipe.phases.deployment.type === "manual";
    }
}
