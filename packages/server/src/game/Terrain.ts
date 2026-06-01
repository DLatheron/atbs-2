import { Orientation } from "@atbs/maths";
import { Description } from "@atbs/shared-data";
import z from "zod";

export const TerrainRecipe = z.object({
    id: z.string(),
    name: z.string().min(1),
    category: z.string().min(1),
    description: Description,
    orientation: z.nativeEnum(Orientation).optional()
});
export type TerrainRecipe = z.infer<typeof TerrainRecipe>;

export class Terrain {
    private readonly _recipe: TerrainRecipe;

    constructor(recipe: TerrainRecipe) {
        this._recipe = recipe;
    }

    get id() {
        return this._recipe.id;
    }

    get name() {
        return this._recipe.name;
    }

    get category() {
        return this._recipe.category;
    }

    get description() {
        return this._recipe.description;
    }

    get orientation() {
        return this._recipe.orientation;
    }
}
