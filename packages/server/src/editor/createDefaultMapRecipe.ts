import { EditorId } from "@atbs/shared-data";
import { Orientation } from "@atbs/maths";
import { MapRecipe, type MapRecipe as MapRecipeType } from "../game/WorldMap.js";
import type { TileRecipe } from "../game/Tile.js";

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 100;
const DEFAULT_TILE_SIZE = 100;

function createGrassTile(): TileRecipe {
    return {
        terrain: {
            id: "grass.terrain",
            orientation: Orientation.NORTH
        }
    };
}

export function createDefaultMapRecipe(editorId: EditorId): MapRecipeType {
    const tiles = Array.from({ length: DEFAULT_HEIGHT }, () =>
        Array.from({ length: DEFAULT_WIDTH }, () => createGrassTile())
    );

    return MapRecipe.parse({
        id: `editor.${editorId}.map`,
        name: `Editor Map ${editorId}`,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        tileSize: DEFAULT_TILE_SIZE,
        tiles
    });
}
