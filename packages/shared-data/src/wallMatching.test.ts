import { describe, expect, it } from "vitest";
import { Orientation } from "@atbs/maths";
import {
    getWallGrid,
    groupWallsByFamily,
    matchWallPieceInFamily,
    wallFamilyId,
    wallsInFamily
} from "./wallMatching";

const CONCRETE = [
    { id: "wall.furniture", edges: ["0-2-0", null, "0-2-0", null] as const },
    { id: "corner-wall.furniture", edges: [null, "0-2-0", "0-2-0", null] as const },
    { id: "t-junction-wall.furniture", edges: ["0-2-0", "0-2-0", "0-2-0", null] as const },
    { id: "cross-wall.furniture", edges: ["0-2-0", "0-2-0", "0-2-0", "0-2-0"] as const },
    { id: "door.furniture", edges: ["0-2-0", null, "0-2-0", null] as const }
];

const STONE = [
    { id: "stone-wall.furniture", edges: ["0-4-0", null, "0-4-0", null] as const },
    { id: "stone-corner-wall.furniture", edges: [null, "0-4-0", "0-4-0", null] as const },
    { id: "stone-t-junction-wall.furniture", edges: ["0-4-0", "0-4-0", "0-4-0", null] as const },
    { id: "stone-cross-wall.furniture", edges: ["0-4-0", "0-4-0", "0-4-0", "0-4-0"] as const }
];

const THICK = [
    { id: "thick-wall.furniture", edges: [null, "0-6-0", null, "0-6-0"] as const },
    { id: "thick-corner-wall.furniture", edges: [null, null, "0-6-0", "0-6-0"] as const },
    { id: "thick-t-junction-wall.furniture", edges: [null, "0-6-0", "0-6-0", "0-6-0"] as const },
    { id: "thick-cross-wall.furniture", edges: ["0-6-0", "0-6-0", "0-6-0", "0-6-0"] as const }
];

const MIXED = [...CONCRETE, ...STONE, ...THICK];

describe("wall families", () => {
    it("groups mixed palettes by edge profile", () => {
        const families = groupWallsByFamily(MIXED);

        expect(families.map((family) => wallFamilyId(family[0].edges))).toEqual([
            "0-2-0",
            "0-4-0",
            "0-6-0"
        ]);
        expect(wallsInFamily(MIXED, "stone-wall.furniture").map((wall) => wall.id)).toEqual(
            STONE.map((wall) => wall.id)
        );
    });

    it("keeps auto-fit on the selected family even when a neighbour is a different type", () => {
        const match = matchWallPieceInFamily({
            surroundingEdges: {
                [Orientation.NORTH]: "0-2-0",
                [Orientation.EAST]: null,
                [Orientation.SOUTH]: null,
                [Orientation.WEST]: "0-2-0"
            },
            walls: MIXED,
            preferredWallId: "stone-wall.furniture",
            fallback: { id: "stone-wall.furniture", orientation: Orientation.NORTH }
        });

        expect(match?.id).toBe("stone-wall.furniture");
    });

    it("still picks a matching piece within the selected family", () => {
        const match = matchWallPieceInFamily({
            surroundingEdges: {
                [Orientation.NORTH]: "0-4-0",
                [Orientation.EAST]: null,
                [Orientation.SOUTH]: null,
                [Orientation.WEST]: "0-4-0"
            },
            walls: MIXED,
            preferredWallId: "stone-wall.furniture",
            fallback: { id: "stone-wall.furniture", orientation: Orientation.NORTH }
        });

        expect(match?.id).toBe("stone-corner-wall.furniture");
    });
});

describe("getWallGrid", () => {
    it("fills the 3x3 with corner, T-junction, and cross pieces of the family", () => {
        const grid = getWallGrid(CONCRETE);
        const byKey = Object.fromEntries(grid.map((cell) => [cell.key, cell.options[0]]));

        expect(byKey.r).toEqual({ id: "corner-wall.furniture", orientation: Orientation.NORTH });
        expect(byKey.y).toEqual({ id: "corner-wall.furniture", orientation: Orientation.WEST });
        expect(byKey.g).toEqual({ id: "cross-wall.furniture", orientation: Orientation.NORTH });
        expect(byKey.t?.id).toBe("t-junction-wall.furniture");
        expect(byKey.f?.id).toBe("t-junction-wall.furniture");
        expect(grid.find((cell) => cell.key === "t")?.options.map((option) => option.id)).toEqual([
            "t-junction-wall.furniture",
            "wall.furniture"
        ]);
    });

    it("finds the same 3x3 for walls whose rest orientation differs", () => {
        const grid = getWallGrid(THICK);
        const byKey = Object.fromEntries(grid.map((cell) => [cell.key, cell.options[0]]));

        expect(byKey.r?.id).toBe("thick-corner-wall.furniture");
        expect(byKey.g?.id).toBe("thick-cross-wall.furniture");
        expect(byKey.t?.id).toBe("thick-t-junction-wall.furniture");
        expect(grid.every((cell) => cell.options.length > 0)).toBe(true);
    });
});
