import { Orientation, TilePos, rotateOrientation } from "@atbs/maths";
import {
    EditorFurnitureTile,
    SelectedWall,
    WallHotKeyAction,
    WallPaletteEntry,
    WallPaletteWire,
    getAdjacentWallEdge,
    matchWallPiece
} from "@atbs/shared-data";

export function createDefaultSelectedWall(): SelectedWall {
    return {
        index: 0,
        orientation: Orientation.NORTH,
        autoFit: true
    };
}

export function getWallPaletteIndex(wallPalette: WallPaletteWire, wallId: string): number {
    const index = wallPalette.walls.findIndex((wall: WallPaletteEntry) => wall.id === wallId);
    return index >= 0 ? index : 0;
}

export function getWallId(
    wallPalette: WallPaletteWire,
    selectedWall: SelectedWall
): string | undefined {
    return wallPalette.walls[selectedWall.index]?.id;
}

function getAdjacentEdgeFromLayer(
    furnitureLayer: EditorFurnitureTile[][],
    wallPalette: WallPaletteWire,
    tilePos: TilePos,
    direction: Orientation
): string | null {
    const neighbor = tilePos.stepInDirection(direction);
    if (
        neighbor.row < 0 ||
        neighbor.col < 0 ||
        neighbor.row >= furnitureLayer.length ||
        neighbor.col >= (furnitureLayer[0]?.length ?? 0)
    ) {
        return null;
    }

    const furniture = furnitureLayer[neighbor.row][neighbor.col];
    if (!furniture) {
        return null;
    }

    const wallEntry = wallPalette.walls.find(
        (wall: WallPaletteEntry) => wall.id === furniture.furnitureId
    );
    if (!wallEntry) {
        return null;
    }

    return getAdjacentWallEdge(wallEntry.edges, furniture.orientation, direction);
}

export function getSurroundingEdgesFromLayer(
    furnitureLayer: EditorFurnitureTile[][],
    wallPalette: WallPaletteWire,
    tilePos: TilePos
) {
    return {
        [Orientation.NORTH]: getAdjacentEdgeFromLayer(
            furnitureLayer,
            wallPalette,
            tilePos,
            Orientation.NORTH
        ),
        [Orientation.EAST]: getAdjacentEdgeFromLayer(
            furnitureLayer,
            wallPalette,
            tilePos,
            Orientation.EAST
        ),
        [Orientation.SOUTH]: getAdjacentEdgeFromLayer(
            furnitureLayer,
            wallPalette,
            tilePos,
            Orientation.SOUTH
        ),
        [Orientation.WEST]: getAdjacentEdgeFromLayer(
            furnitureLayer,
            wallPalette,
            tilePos,
            Orientation.WEST
        )
    };
}

export function matchWallForTile(
    wallPalette: WallPaletteWire,
    furnitureLayer: EditorFurnitureTile[][],
    tilePos: TilePos,
    selectedWall: SelectedWall
): SelectedWall {
    const fallbackWall = wallPalette.walls[selectedWall.index] ?? wallPalette.walls[0];
    const fallback = {
        id: fallbackWall.id,
        orientation: selectedWall.orientation
    };

    if (!selectedWall.autoFit) {
        return selectedWall;
    }

    const surroundingEdges = getSurroundingEdgesFromLayer(furnitureLayer, wallPalette, tilePos);
    const matched = matchWallPiece({
        surroundingEdges,
        walls: wallPalette.walls,
        preferredDirection: selectedWall.direction,
        fallback
    });

    if (!matched) {
        return selectedWall;
    }

    return {
        ...selectedWall,
        index: getWallPaletteIndex(wallPalette, matched.id),
        orientation: matched.orientation
    };
}

export function rotateWallSelection(selectedWall: SelectedWall, steps: -2 | 2): SelectedWall {
    return {
        ...selectedWall,
        orientation: rotateOrientation(selectedWall.orientation, steps)
    };
}

export function applyWallHotKey(
    wallPalette: WallPaletteWire,
    selectedWall: SelectedWall,
    key: string
): SelectedWall | undefined {
    const hotKeyActions = wallPalette.hotKeys?.[key];
    if (!hotKeyActions || hotKeyActions.length === 0) {
        return undefined;
    }

    const currentWall = wallPalette.walls[selectedWall.index];
    let hotKeyIndex = hotKeyActions.findIndex(
        (entry: WallHotKeyAction) =>
            entry.id === currentWall?.id && entry.orientation === selectedWall.orientation
    );
    hotKeyIndex = (hotKeyIndex + 1) % hotKeyActions.length;

    const selectedAction = hotKeyActions[hotKeyIndex];

    return {
        index: getWallPaletteIndex(wallPalette, selectedAction.id),
        orientation: selectedAction.orientation,
        autoFit: false,
        direction: selectedWall.direction
    };
}
