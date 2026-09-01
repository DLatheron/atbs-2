import { ItemPaletteWire, RenderMode, SceneObject } from "@atbs/shared-data";
import z from "zod";
import { ItemRecipeManager } from "../game/ItemRecipeManager.js";

export const ItemPaletteRecipe = z.object({
    id: z.string(),
    name: z.string(),
    items: z.array(
        z.object({
            id: z.string().nonempty()
        })
    )
});
export type ItemPaletteRecipe = z.infer<typeof ItemPaletteRecipe>;

export class ItemPalette {
    private readonly _recipe: ItemPaletteRecipe;
    private readonly _itemIds: string[];

    constructor(recipe: ItemPaletteRecipe) {
        this._recipe = recipe;
        this._itemIds = recipe.items.map(({ id }) => id);
    }

    get id() {
        return this._recipe.id;
    }

    get name() {
        return this._recipe.name;
    }

    get itemIds() {
        return this._itemIds;
    }

    toWireFormat(itemRecipeManager: ItemRecipeManager): ItemPaletteWire {
        const uiCache = new Map<
            string,
            { name: string; uiImage: ReturnType<SceneObject["getRenderList"]> }
        >();

        const getUiEntry = (itemId: string) => {
            const cached = uiCache.get(itemId);
            if (cached) {
                return cached;
            }

            const recipe = itemRecipeManager.getRecipe(itemId);
            const sceneObject = new SceneObject(recipe.renderable);
            const entry = {
                name: recipe.name,
                uiImage: sceneObject.getRenderList({
                    renderMode: RenderMode.enum.UI_MODE,
                    states: []
                })
            };
            uiCache.set(itemId, entry);
            return entry;
        };

        return {
            items: this._itemIds.map((id) => {
                const { name, uiImage } = getUiEntry(id);
                return { id, name, uiImage };
            })
        };
    }
}
