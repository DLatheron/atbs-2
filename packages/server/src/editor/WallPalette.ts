import {
    RenderMode,
    SceneObject,
    WallEdgeTuple,
    WallHotKeyAction,
    WallPaletteWire
} from "@atbs/shared-data";
import { Orientation, TilePos } from "@atbs/maths";
import z from "zod";
import { FurnitureRecipeManager } from "../game/FurnitureRecipeManager.js";
import type { WorldMap } from "../game/WorldMap.js";
import {
    getAdjacentWallEdge,
    matchWallPiece,
    type SurroundingWallEdges
} from "@atbs/shared-data";

export const WallPaletteRecipe = z.object({
    id: z.string(),
    name: z.string(),
    walls: z
        .array(
            z.object({
                id: z.string().nonempty(),
                edges: z.tuple([
                    z.string().nullable(),
                    z.string().nullable(),
                    z.string().nullable(),
                    z.string().nullable()
                ])
            })
        )
        .min(1),
    hotKeys: z.record(z.string(), z.array(WallHotKeyAction)).optional()
});
export type WallPaletteRecipe = z.infer<typeof WallPaletteRecipe>;

export interface WallPaletteEntryDefinition {
    id: string;
    edges: WallEdgeTuple;
}

export class WallPalette {
    private readonly _recipe: WallPaletteRecipe;
    private readonly _entries: WallPaletteEntryDefinition[];

    constructor(recipe: WallPaletteRecipe) {
        this._recipe = recipe;
        this._entries = recipe.walls.map(({ id, edges }) => ({ id, edges }));
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

    get hotKeys() {
        return this._recipe.hotKeys;
    }

    getWallById(id: string): WallPaletteEntryDefinition | undefined {
        return this._entries.find((entry) => entry.id === id);
    }

    isWallFurniture(furnitureId: string): boolean {
        return this._entries.some((entry) => entry.id === furnitureId);
    }

    getSurroundingEdges(map: WorldMap, tilePos: TilePos): SurroundingWallEdges {
        const getAdjacentEdge = (direction: Orientation): string | null => {
            const neighbor = map.getTile(tilePos.stepInDirection(direction));
            const furnitureState = neighbor.getFurnitureState();
            if (!furnitureState.furnitureId || !this.isWallFurniture(furnitureState.furnitureId)) {
                return null;
            }

            const wallEntry = this.getWallById(furnitureState.furnitureId);
            if (!wallEntry) {
                return null;
            }

            return getAdjacentWallEdge(
                wallEntry.edges,
                furnitureState.orientation ?? Orientation.NORTH,
                direction
            );
        };

        return {
            [Orientation.NORTH]: getAdjacentEdge(Orientation.NORTH),
            [Orientation.EAST]: getAdjacentEdge(Orientation.EAST),
            [Orientation.SOUTH]: getAdjacentEdge(Orientation.SOUTH),
            [Orientation.WEST]: getAdjacentEdge(Orientation.WEST)
        };
    }

    matchWall(
        map: WorldMap,
        tilePos: TilePos,
        fallback: { id: string; orientation: Orientation },
        preferredDirection?: Orientation
    ): { id: string; orientation: Orientation } {
        const surroundingEdges = this.getSurroundingEdges(map, tilePos);

        return (
            matchWallPiece({
                surroundingEdges,
                walls: this._entries,
                preferredDirection,
                fallback
            }) ?? fallback
        );
    }

    toWireFormat(furnitureRecipeManager: FurnitureRecipeManager): WallPaletteWire {
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
            walls: this._entries.map(({ id, edges }) => {
                const { name, uiImage } = getUiEntry(id);
                return { id, name, uiImage, edges };
            }),
            hotKeys: this.hotKeys
        };
    }
}
