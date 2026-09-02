import { Orientation, randomOrientation } from "@atbs/maths";
import type { MapResizeAnchor } from "./types/EditorTypes.js";

export type { MapResizeAnchor } from "./types/EditorTypes.js";
export { MAP_RESIZE_ANCHORS } from "./types/EditorTypes.js";

export interface ResizeMapTileRecipe {
    terrain: {
        id: string;
        orientation?: Orientation;
    };
    furniture?: {
        id: string;
        orientation?: Orientation;
        state?: string;
    };
    items?: {
        id: string;
        overrides?: Record<string, unknown>;
    }[];
}

export interface ResizeMapRecipeInput<T extends ResizeMapTileRecipe = ResizeMapTileRecipe> {
    width: number;
    height: number;
    tiles: T[][];
}

export interface ResizeMapRecipeOptions {
    width: number;
    height: number;
    anchor: MapResizeAnchor;
    defaultTerrainId: string;
    defaultOrientation: Orientation;
    randomiseOrientation: boolean;
}

export function getMapResizeAnchorOffsets(
    anchor: MapResizeAnchor,
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number
): { colOffset: number; rowOffset: number } {
    const widthDelta = newWidth - oldWidth;
    const heightDelta = newHeight - oldHeight;

    switch (anchor) {
        case "north-west":
            return { colOffset: 0, rowOffset: 0 };
        case "north":
            return { colOffset: Math.floor(widthDelta / 2), rowOffset: 0 };
        case "north-east":
            return { colOffset: widthDelta, rowOffset: 0 };
        case "west":
            return { colOffset: 0, rowOffset: Math.floor(heightDelta / 2) };
        case "center":
            return {
                colOffset: Math.floor(widthDelta / 2),
                rowOffset: Math.floor(heightDelta / 2)
            };
        case "east":
            return { colOffset: widthDelta, rowOffset: Math.floor(heightDelta / 2) };
        case "south-west":
            return { colOffset: 0, rowOffset: heightDelta };
        case "south":
            return { colOffset: Math.floor(widthDelta / 2), rowOffset: heightDelta };
        case "south-east":
            return { colOffset: widthDelta, rowOffset: heightDelta };
    }
}

function createDefaultTile(
    options: ResizeMapRecipeOptions,
    randomise: () => Orientation
): ResizeMapTileRecipe {
    const orientation = options.randomiseOrientation
        ? randomise()
        : options.defaultOrientation;

    return {
        terrain: {
            id: options.defaultTerrainId,
            orientation
        }
    };
}

export function resizeMapRecipe<T extends ResizeMapTileRecipe>(
    recipe: ResizeMapRecipeInput<T>,
    options: ResizeMapRecipeOptions,
    randomise: () => Orientation = randomOrientation
): { width: number; height: number; tiles: T[][] } {
    const { width: newWidth, height: newHeight } = options;
    const { colOffset, rowOffset } = getMapResizeAnchorOffsets(
        options.anchor,
        recipe.width,
        recipe.height,
        newWidth,
        newHeight
    );

    const defaultTile = createDefaultTile(options, randomise);
    const tiles: T[][] = Array.from({ length: newHeight }, (_row, newRow) =>
        Array.from({ length: newWidth }, (_col, newCol) => {
            const oldCol = newCol - colOffset;
            const oldRow = newRow - rowOffset;

            if (
                oldCol >= 0 &&
                oldCol < recipe.width &&
                oldRow >= 0 &&
                oldRow < recipe.height
            ) {
                return structuredClone(recipe.tiles[oldRow][oldCol]);
            }

            return structuredClone(defaultTile) as T;
        })
    );

    return {
        width: newWidth,
        height: newHeight,
        tiles
    };
}
