import { Orientation } from "@atbs/maths";
import { Description } from "@atbs/shared-data";
import z from "zod";

import { SceneNode, SceneObject } from "./SceneObject.js";

export const TerrainRecipe = z.object({
    id: z.string(),
    name: z.string().min(1),
    category: z.string().min(1),
    description: Description,
    orientation: z.enum(Orientation).optional(),
    renderable: SceneNode
});
export type TerrainRecipe = z.infer<typeof TerrainRecipe>;

export class Terrain extends SceneObject {
    private readonly _recipe: Readonly<TerrainRecipe>;

    constructor(recipe: Readonly<TerrainRecipe>) {
        super(recipe.renderable);
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
