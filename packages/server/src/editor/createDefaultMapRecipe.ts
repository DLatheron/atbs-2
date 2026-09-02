import { EditorId } from "@atbs/shared-data";
import { Orientation, randomOrientation } from "@atbs/maths";
import { MapRecipe, type MapRecipe as MapRecipeType } from "../game/WorldMap.js";
import type { TileRecipe } from "../game/Tile.js";

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 100;
const DEFAULT_TILE_SIZE = 100;

export interface CreateMapRecipeOptions {
    width: number;
    height: number;
    defaultTerrainId: string;
    defaultOrientation: Orientation;
    randomiseOrientation: boolean;
}

function createTerrainTile(
    options: CreateMapRecipeOptions,
    randomise: () => Orientation = randomOrientation
): TileRecipe {
    return {
        terrain: {
            id: options.defaultTerrainId,
            orientation: options.randomiseOrientation
                ? randomise()
                : options.defaultOrientation
        }
    };
}

export function createMapRecipe(
    editorId: EditorId,
    options: CreateMapRecipeOptions,
    randomise: () => Orientation = randomOrientation
): MapRecipeType {
    const tiles = Array.from({ length: options.height }, () =>
        Array.from({ length: options.width }, () => createTerrainTile(options, randomise))
    );

    return MapRecipe.parse({
        id: `editor.${editorId}.map`,
        name: `Editor Map ${editorId}`,
        width: options.width,
        height: options.height,
        tileSize: DEFAULT_TILE_SIZE,
        tiles
    });
}

export function createDefaultMapRecipe(editorId: EditorId): MapRecipeType {
    return createMapRecipe(editorId, {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        defaultTerrainId: "grass.terrain",
        defaultOrientation: Orientation.NORTH,
        randomiseOrientation: false
    });
}
