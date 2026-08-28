import { TerrainPaletteWire } from "@atbs/shared-data";
import { RenderMode } from "@atbs/shared-data";
import z from "zod";
import { BlendManager } from "../game/BlendManager.js";
import { TerrainManager } from "../game/TerrainManager.js";

export const TerrainPaletteRecipe = z.object({
    id: z.string(),
    name: z.string(),
    terrains: z.array(z.string().nonempty()).min(1),
    blends: z.array(z.string().nonempty()).min(1),
    noRandomOrientation: z.array(z.string().nonempty()).optional().default([])
});
export type TerrainPaletteRecipe = z.infer<typeof TerrainPaletteRecipe>;

export class TerrainPalette {
    private readonly _recipe: TerrainPaletteRecipe;
    private readonly _noRandomOrientation: Set<string>;

    constructor(recipe: TerrainPaletteRecipe) {
        this._recipe = recipe;
        this._noRandomOrientation = new Set(recipe.noRandomOrientation);
    }

    get id() {
        return this._recipe.id;
    }

    get name() {
        return this._recipe.name;
    }

    get terrainIds() {
        return this._recipe.terrains;
    }

    get blendIds() {
        return this._recipe.blends;
    }

    allowsRandomOrientation(terrainId: string): boolean {
        return !this._noRandomOrientation.has(terrainId);
    }

    getTerrainById(terrainId: string) {
        if (!this._recipe.terrains.includes(terrainId)) {
            return undefined;
        }

        return TerrainManager.GetSingleton().get(terrainId);
    }

    toWireFormat(): TerrainPaletteWire {
        const terrainManager = TerrainManager.GetSingleton();
        const blendManager = BlendManager.GetSingleton();

        return {
            terrains: this._recipe.terrains.map((terrainId) => {
                const terrain = terrainManager.get(terrainId);
                return {
                    id: terrain.id,
                    name: terrain.name,
                    uiImage: terrain.getRenderList({
                        renderMode: RenderMode.enum.UI_MODE,
                        states: []
                    }),
                    allowRandomOrientation: this.allowsRandomOrientation(terrainId)
                };
            }),
            blends: this._recipe.blends.map((blendId) => {
                const blend = blendManager.get(blendId);
                return {
                    id: blend.id,
                    name: blend.name,
                    uiImage: blend.getRenderList({
                        renderMode: RenderMode.enum.UI_MODE,
                        states: []
                    })
                };
            })
        };
    }
}
