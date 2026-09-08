import { Orientation, TilePos, rotateOrientation } from "@atbs/maths";
import {
    EditorFurnitureTile,
    SelectedWall,
    WallPaletteEntry,
    WallPaletteWire,
    getAdjacentWallEdge,
    getWallGrid,
    groupWallsByFamily,
    isStraightWall,
    matchWallPieceInFamily,
    orientationForVerticalStraight,
    wallFamilyId
} from "@atbs/shared-data";

export function createDefaultSelectedWall(): SelectedWall {
    return {
        index: 0,
        orientation: Orientation.NORTH,
        autoFit: true,
        pinned: false
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

/** Wall id used as the auto-fit family seed when painting. */
export function getWallPaintId(
    wallPalette: WallPaletteWire,
    selectedWall: SelectedWall
): string | undefined {
    if (selectedWall.autoFit && !selectedWall.pinned) {
        const family = getSelectedWallFamily(wallPalette, selectedWall);
        return family?.representative.id ?? getWallId(wallPalette, selectedWall);
    }

    return getWallId(wallPalette, selectedWall);
}

export function isWallPiecePinned(selectedWall: SelectedWall): boolean {
    return selectedWall.pinned || !selectedWall.autoFit;
}

export interface WallFamily {
    id: string;
    name: string;
    representative: WallPaletteEntry;
    previewOrientation: Orientation;
    members: WallPaletteEntry[];
}

export function getWallFamilies(wallPalette: WallPaletteWire): WallFamily[] {
    return groupWallsByFamily(wallPalette.walls).map((members) => {
        const representative = members.find((member) => isStraightWall(member.edges)) ?? members[0];

        return {
            id: wallFamilyId(representative.edges),
            name: representative.name,
            representative,
            previewOrientation: orientationForVerticalStraight(representative.edges),
            members
        };
    });
}

export function getSelectedWallFamily(
    wallPalette: WallPaletteWire,
    selectedWall: SelectedWall
): WallFamily | undefined {
    const selected = wallPalette.walls[selectedWall.index];
    if (!selected) {
        return undefined;
    }

    const familyId = wallFamilyId(selected.edges);
    return getWallFamilies(wallPalette).find((family) => family.id === familyId);
}

export function selectWallFamily(
    wallPalette: WallPaletteWire,
    selectedWall: SelectedWall,
    familyId: string
): SelectedWall {
    const current = getSelectedWallFamily(wallPalette, selectedWall);
    if (current?.id === familyId) {
        return selectedWall;
    }

    const family = getWallFamilies(wallPalette).find((entry) => entry.id === familyId);
    if (!family) {
        return selectedWall;
    }

    return {
        ...selectedWall,
        index: getWallPaletteIndex(wallPalette, family.representative.id),
        orientation: Orientation.NORTH,
        pinned: false
    };
}

export function clearWallPieceSelection(
    wallPalette: WallPaletteWire,
    selectedWall: SelectedWall
): SelectedWall {
    const family = getSelectedWallFamily(wallPalette, selectedWall);
    const representative = family?.representative ?? wallPalette.walls[selectedWall.index];

    return {
        ...selectedWall,
        index: representative
            ? getWallPaletteIndex(wallPalette, representative.id)
            : selectedWall.index,
        orientation: Orientation.NORTH,
        pinned: false,
        autoFit: true
    };
}

export function getSelectedWallGrid(wallPalette: WallPaletteWire, selectedWall: SelectedWall) {
    const family = getSelectedWallFamily(wallPalette, selectedWall);
    return getWallGrid(family?.members ?? []);
}

export function getFamilyExtraWalls(
    wallPalette: WallPaletteWire,
    selectedWall: SelectedWall
): WallPaletteEntry[] {
    const family = getSelectedWallFamily(wallPalette, selectedWall);
    if (!family) {
        return [];
    }

    const usedIds = new Set(
        getWallGrid(family.members).flatMap((cell) => cell.options.map((option) => option.id))
    );

    return family.members.filter((member) => !usedIds.has(member.id));
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
    const matched = matchWallPieceInFamily({
        surroundingEdges,
        walls: wallPalette.walls,
        preferredWallId: fallback.id,
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

const TOP_BOTTOM_CELLS = new Set(["t", "b"]);
const LEFT_RIGHT_T_CELLS = new Set(["f", "h"]);
const CORNER_CELLS = new Set(["r", "y", "v", "n"]);
const LEFT_RIGHT_COLUMN_CELLS = new Set(["r", "f", "v", "y", "h", "n"]);
/** Top-right / bottom-left — diagonal opposites in the 3x3. */
const DIAGONAL_CORNER_CELLS = new Set(["y", "v"]);

/**
 * Extra UI rotation for the 3x3 preview only. Placement/hotkeys keep the
 * edge-matching orientation; some families' sprites don't face the same way
 * as their edge tuples (or the CSS preview negates 90° turns).
 */
export function wallGridPreviewOrientation(
    familyId: string,
    cellKey: string,
    orientation: Orientation
): Orientation {
    if (familyId === "0-2-0" || familyId === "0-4-0") {
        return TOP_BOTTOM_CELLS.has(cellKey) ? rotateOrientation(orientation, 4) : orientation;
    }

    if (familyId === "0-3-0") {
        return LEFT_RIGHT_T_CELLS.has(cellKey) ? rotateOrientation(orientation, 4) : orientation;
    }

    if (familyId === "0-5-0") {
        return CORNER_CELLS.has(cellKey) ? rotateOrientation(orientation, 4) : orientation;
    }

    if (familyId === "0-6-0" || familyId === "0-7-0" || familyId === "0-6-0|0-7-0") {
        // Top-right / bottom-left use 180° placements; mirroring is a no-op for
        // those, so swap them with an extra half-turn.
        if (DIAGONAL_CORNER_CELLS.has(cellKey)) {
            return rotateOrientation(orientation, 4);
        }

        return LEFT_RIGHT_COLUMN_CELLS.has(cellKey)
            ? rotateOrientation(Orientation.NORTH, -orientation)
            : orientation;
    }

    return orientation;
}

export function selectWallGridOption(
    wallPalette: WallPaletteWire,
    selectedWall: SelectedWall,
    option: { id: string; orientation: Orientation }
): SelectedWall {
    return {
        ...selectedWall,
        index: getWallPaletteIndex(wallPalette, option.id),
        orientation: option.orientation,
        pinned: true
    };
}

export function applyWallHotKey(
    wallPalette: WallPaletteWire,
    selectedWall: SelectedWall,
    key: string
): SelectedWall | undefined {
    const grid = getSelectedWallGrid(wallPalette, selectedWall);
    const cell = grid.find((entry) => entry.key === key);
    if (!cell || cell.options.length === 0) {
        return undefined;
    }

    const currentWall = wallPalette.walls[selectedWall.index];
    let optionIndex = cell.options.findIndex(
        (option) => option.id === currentWall?.id && option.orientation === selectedWall.orientation
    );
    optionIndex = (optionIndex + 1) % cell.options.length;

    return selectWallGridOption(wallPalette, selectedWall, cell.options[optionIndex]);
}
