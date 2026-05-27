import { Description, SideId } from "@atbs/shared-data";
import z from "zod";

export const SideRecipe = z.object({
    id: SideId,
    name: z.string().min(1),
    description: Description
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
}
