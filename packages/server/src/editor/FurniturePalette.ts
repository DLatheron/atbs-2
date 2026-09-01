import { FurniturePaletteWire, RenderMode, SceneObject } from "@atbs/shared-data";
import { Orientation } from "@atbs/maths";
import z from "zod";
import { FurnitureRecipeManager } from "../game/FurnitureRecipeManager.js";

const FurniturePaletteTileRef = z.union([
    z.string().nonempty(),
    z.object({
        id: z.string().nonempty(),
        orientation: z.enum(Orientation).optional()
    })
]);

export const FurniturePaletteRecipe = z.object({
    id: z.string(),
    name: z.string(),
    furniture: z.array(
        z.object({
            id: z.string().nonempty(),
            tiles: z.array(z.array(FurniturePaletteTileRef)).min(1),
            allowRandomOrientation: z.boolean().default(true)
        })
    )
});
export type FurniturePaletteRecipe = z.infer<typeof FurniturePaletteRecipe>;

export interface FurniturePaletteTileDefinition {
    furnitureId: string;
    orientation: Orientation;
}

export interface FurniturePaletteEntryDefinition {
    id: string;
    tiles: FurniturePaletteTileDefinition[][];
    allowRandomOrientation: boolean;
}

export class FurniturePalette {
    private readonly _recipe: FurniturePaletteRecipe;
    private readonly _entries: FurniturePaletteEntryDefinition[];

    constructor(recipe: FurniturePaletteRecipe) {
        this._recipe = recipe;
        this._entries = recipe.furniture.map(({ id, tiles, allowRandomOrientation }) => ({
            id,
            tiles: tiles.map((row) =>
                row.map((ref) => {
                    if (typeof ref === "string") {
                        return { furnitureId: ref, orientation: Orientation.NORTH };
                    }
                    return {
                        furnitureId: ref.id,
                        orientation: ref.orientation ?? Orientation.NORTH
                    };
                })
            ),
            allowRandomOrientation
        }));
    }

    get id() {
        return this._recipe.id;
    }

    get name() {
        return this._recipe.name;
    }

    get entries() {
        return this._entries;
    }

    getFurnitureById(id: string): FurniturePaletteEntryDefinition | undefined {
        return this._entries.find((entry) => entry.id === id);
    }

    toWireFormat(furnitureRecipeManager: FurnitureRecipeManager): FurniturePaletteWire {
        const uiCache = new Map<
            string,
            { name: string; uiImage: ReturnType<SceneObject["getRenderList"]> }
        >();

        const getUiEntry = (furnitureId: string) => {
            const cached = uiCache.get(furnitureId);
            if (cached) {
                return cached;
            }

            const recipe = furnitureRecipeManager.getRecipe(furnitureId);
            const sceneObject = new SceneObject(recipe.renderable);
            const entry = {
                name: recipe.name,
                uiImage: sceneObject.getRenderList({
                    renderMode: RenderMode.enum.UI_MODE,
                    states: []
                })
            };
            uiCache.set(furnitureId, entry);
            return entry;
        };

        return {
            furniture: this._entries.map(({ id, tiles, allowRandomOrientation }) => ({
                id,
                allowRandomOrientation,
                furniture: tiles.map((row) =>
                    row.map(({ furnitureId }) => {
                        const { name, uiImage } = getUiEntry(furnitureId);
                        return { id: furnitureId, name, uiImage };
                    })
                )
            }))
        };
    }
}
