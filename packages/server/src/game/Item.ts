import { Description, InstanceId, ItemId, RenderList } from "@atbs/shared-data";
import z from "zod";
import { SceneContext, SceneNode, SceneObject } from "./SceneObject.js";
import { TilePos, TilePosRecipe } from "@atbs/maths";

export const ItemRecipe = z.object({
    id: ItemId,
    name: z.string(),
    description: Description,
    quantity: z.number().nonnegative().optional().default(1),
    weight: z.number().positive(),
    renderable: SceneNode
});
export type ItemRecipe = z.infer<typeof ItemRecipe>;

export const ItemOverrides = z
    .object({
        location: TilePosRecipe,
        quantity: z.number().positive()
    })
    .partial();
export type ItemOverrides = z.infer<typeof ItemOverrides>;

export interface ItemAdditionalData {
    instanceIndex: number;
}

export class Item extends SceneObject {
    private readonly _id: ItemId;
    private readonly _recipe: Readonly<ItemRecipe>;

    private _location: TilePos | null;
    private _quantity;

    constructor(
        recipe: ItemRecipe,
        overrides: Readonly<ItemOverrides>,
        additionalData: Readonly<ItemAdditionalData>
    ) {
        super(recipe.renderable);

        this._id = `${recipe.id}-${additionalData.instanceIndex}`;
        this._recipe = recipe;

        this._location = overrides.location ? new TilePos(overrides.location) : null;
        this._quantity = overrides.quantity ?? recipe.quantity;
    }

    get id(): InstanceId {
        return this._id;
    }

    get recipeId(): ItemId {
        return this._recipe.id;
    }

    get name(): string {
        return this._recipe.name;
    }

    get description(): Description {
        return this._recipe.description;
    }

    get location(): TilePos | null {
        return this._location;
    }

    get mapLocation(): TilePos {
        if (!this._location) {
            throw new Error(`Unit ${this.id} is not on the map`);
        }

        return this._location;
    }

    set location(value: TilePos | null) {
        this._location = value;
    }

    get quantity(): number {
        return this._quantity;
    }

    set quantity(value: number) {
        this._quantity = value;
    }

    getRenderList(context: SceneContext): RenderList {
        const unitContext = { ...context, states: [] };

        return super.getRenderList(unitContext);
    }
}
