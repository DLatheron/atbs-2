import { Description, SceneNode, SceneObject } from "@atbs/shared-data";
import z from "zod";

export const BlendRecipe = z.object({
    id: z.string(),
    name: z.string().nonempty(),
    category: z.string().nonempty(),
    description: Description,
    renderable: SceneNode
});
export type BlendRecipe = z.infer<typeof BlendRecipe>;

export class Blend extends SceneObject {
    private readonly _recipe: Readonly<BlendRecipe>;

    constructor(recipe: Readonly<BlendRecipe>) {
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
}
