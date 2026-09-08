import { describe, expect, it } from "vitest";
import { Orientation } from "@atbs/maths";
import { SelectedWall, WallPaletteWire } from "@atbs/shared-data";
import {
    applyWallHotKey,
    clearWallPieceSelection,
    getFamilyExtraWalls,
    getSelectedWallFamily,
    getWallFamilies,
    getWallPaintId,
    isWallPiecePinned,
    selectWallFamily,
    selectWallGridOption,
    wallGridPreviewOrientation
} from "./wallHelpers";

const PALETTE = {
    walls: [
        {
            id: "wall.furniture",
            name: "Wall",
            uiImage: [],
            edges: ["0-2-0", null, "0-2-0", null]
        },
        {
            id: "corner-wall.furniture",
            name: "Wall Corner",
            uiImage: [],
            edges: [null, "0-2-0", "0-2-0", null]
        },
        {
            id: "t-junction-wall.furniture",
            name: "Wall T-Junction",
            uiImage: [],
            edges: ["0-2-0", "0-2-0", "0-2-0", null]
        },
        {
            id: "cross-wall.furniture",
            name: "Wall Cross",
            uiImage: [],
            edges: ["0-2-0", "0-2-0", "0-2-0", "0-2-0"]
        },
        {
            id: "door.furniture",
            name: "Door",
            uiImage: [],
            edges: ["0-2-0", null, "0-2-0", null]
        },
        {
            id: "stone-wall.furniture",
            name: "Stone Wall",
            uiImage: [],
            edges: ["0-4-0", null, "0-4-0", null]
        },
        {
            id: "stone-corner-wall.furniture",
            name: "Stone Wall Corner",
            uiImage: [],
            edges: [null, "0-4-0", "0-4-0", null]
        }
    ]
} as WallPaletteWire;

function selection(overrides: Partial<SelectedWall> = {}): SelectedWall {
    return {
        index: 0,
        orientation: Orientation.NORTH,
        autoFit: true,
        pinned: false,
        ...overrides
    };
}

describe("wall type selection", () => {
    it("lists each edge family once, named after its straight piece", () => {
        const families = getWallFamilies(PALETTE);

        expect(families.map((family) => family.name)).toEqual(["Wall", "Stone Wall"]);
    });

    it("switches the selected piece to the chosen type", () => {
        const next = selectWallFamily(PALETTE, selection({ pinned: true }), "0-4-0");

        expect(PALETTE.walls[next.index].id).toBe("stone-wall.furniture");
        expect(getSelectedWallFamily(PALETTE, next)?.name).toBe("Stone Wall");
        expect(next.pinned).toBe(false);
    });
});

describe("wall piece pin / clear", () => {
    it("pins a grid option without turning auto-select off", () => {
        const next = selectWallGridOption(PALETTE, selection(), {
            id: "cross-wall.furniture",
            orientation: Orientation.NORTH
        });

        expect(next.autoFit).toBe(true);
        expect(next.pinned).toBe(true);
        expect(isWallPiecePinned(next)).toBe(true);
        expect(PALETTE.walls[next.index].id).toBe("cross-wall.furniture");
    });

    it("clears a pinned piece and restores auto-select", () => {
        const pinned = selectWallGridOption(PALETTE, selection(), {
            id: "cross-wall.furniture",
            orientation: Orientation.NORTH
        });
        const cleared = clearWallPieceSelection(PALETTE, pinned);

        expect(cleared.pinned).toBe(false);
        expect(cleared.autoFit).toBe(true);
        expect(PALETTE.walls[cleared.index].id).toBe("wall.furniture");
        expect(isWallPiecePinned(cleared)).toBe(false);
    });

    it("uses the family straight piece as the paint seed when unpinned", () => {
        const pinnedCorner = selectWallGridOption(PALETTE, selection(), {
            id: "corner-wall.furniture",
            orientation: Orientation.NORTH
        });
        expect(getWallPaintId(PALETTE, pinnedCorner)).toBe("corner-wall.furniture");

        const unpinned = clearWallPieceSelection(PALETTE, pinnedCorner);
        expect(getWallPaintId(PALETTE, unpinned)).toBe("wall.furniture");
    });
});

describe("wall grid hotkeys", () => {
    it("picks the selected type's corner instead of the default concrete corner", () => {
        const stone = selectWallFamily(PALETTE, selection(), "0-4-0");
        const next = applyWallHotKey(PALETTE, stone, "r");

        expect(next?.autoFit).toBe(true);
        expect(next?.pinned).toBe(true);
        expect(PALETTE.walls[next!.index].id).toBe("stone-corner-wall.furniture");
    });

    it("cycles T-junction and straight on a cardinal key", () => {
        const first = applyWallHotKey(PALETTE, selection({ autoFit: false }), "f");
        const second = applyWallHotKey(PALETTE, first!, "f");

        expect(PALETTE.walls[first!.index].id).toBe("t-junction-wall.furniture");
        expect(PALETTE.walls[second!.index].id).toBe("wall.furniture");
    });

    it("selecting a grid option does not re-enable auto-select when it was off", () => {
        const next = selectWallGridOption(PALETTE, selection({ autoFit: false }), {
            id: "cross-wall.furniture",
            orientation: Orientation.NORTH
        });

        expect(next.autoFit).toBe(false);
        expect(next.pinned).toBe(true);
        expect(PALETTE.walls[next.index].id).toBe("cross-wall.furniture");
    });

    it("lists doors as extra pieces outside the 3x3 grid", () => {
        expect(getFamilyExtraWalls(PALETTE, selection()).map((wall) => wall.id)).toEqual([
            "door.furniture"
        ]);
        expect(getFamilyExtraWalls(PALETTE, selectWallFamily(PALETTE, selection(), "0-4-0"))).toEqual(
            []
        );
    });
});

describe("wallGridPreviewOrientation", () => {
    it("turns concrete and stone top/bottom T previews around", () => {
        expect(wallGridPreviewOrientation("0-2-0", "t", Orientation.EAST)).toBe(Orientation.WEST);
        expect(wallGridPreviewOrientation("0-4-0", "b", Orientation.SOUTH)).toBe(Orientation.NORTH);
        expect(wallGridPreviewOrientation("0-2-0", "f", Orientation.NORTH)).toBe(Orientation.NORTH);
    });

    it("turns cyan left/right T previews around", () => {
        expect(wallGridPreviewOrientation("0-3-0", "f", Orientation.NORTH)).toBe(Orientation.SOUTH);
        expect(wallGridPreviewOrientation("0-3-0", "h", Orientation.SOUTH)).toBe(Orientation.NORTH);
        expect(wallGridPreviewOrientation("0-3-0", "t", Orientation.EAST)).toBe(Orientation.EAST);
    });

    it("transposes alien corner previews", () => {
        expect(wallGridPreviewOrientation("0-5-0", "r", Orientation.NORTH)).toBe(Orientation.SOUTH);
        expect(wallGridPreviewOrientation("0-5-0", "y", Orientation.WEST)).toBe(Orientation.EAST);
        expect(wallGridPreviewOrientation("0-5-0", "g", Orientation.NORTH)).toBe(Orientation.NORTH);
    });

    it("mirrors thick and thin left/right column previews", () => {
        expect(wallGridPreviewOrientation("0-6-0", "r", Orientation.WEST)).toBe(Orientation.EAST);
        expect(wallGridPreviewOrientation("0-7-0", "f", Orientation.WEST)).toBe(Orientation.EAST);
        expect(wallGridPreviewOrientation("0-6-0", "t", Orientation.NORTH)).toBe(Orientation.NORTH);
    });

    it("swaps thick and thin top-right and bottom-left corner previews", () => {
        expect(wallGridPreviewOrientation("0-6-0", "y", Orientation.SOUTH)).toBe(Orientation.NORTH);
        expect(wallGridPreviewOrientation("0-6-0", "v", Orientation.NORTH)).toBe(Orientation.SOUTH);
        expect(wallGridPreviewOrientation("0-7-0", "y", Orientation.SOUTH)).toBe(Orientation.NORTH);
        expect(wallGridPreviewOrientation("0-7-0", "v", Orientation.NORTH)).toBe(Orientation.SOUTH);
    });
});
