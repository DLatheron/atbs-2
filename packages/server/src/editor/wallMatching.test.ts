import { describe, expect, it } from "vitest";
import { Orientation } from "@atbs/maths";
import { matchWallPiece, rotateWallEdges } from "@atbs/shared-data";

const WALL_PALETTE = [
    { id: "wall.furniture", edges: ["0-2-0", null, "0-2-0", null] as const },
    { id: "corner-wall.furniture", edges: [null, "0-2-0", "0-2-0", null] as const },
    { id: "t-junction-wall.furniture", edges: ["0-2-0", "0-2-0", "0-2-0", null] as const },
    { id: "cross-wall.furniture", edges: ["0-2-0", "0-2-0", "0-2-0", "0-2-0"] as const }
];

describe("rotateWallEdges", () => {
    it("rotates a horizontal wall edge pair to east-west", () => {
        expect(rotateWallEdges(["0-2-0", null, "0-2-0", null], Orientation.EAST)).toEqual([
            null,
            "0-2-0",
            null,
            "0-2-0"
        ]);
    });
});

describe("matchWallPiece", () => {
    it("selects a straight wall for an isolated tile", () => {
        const match = matchWallPiece({
            surroundingEdges: {
                [Orientation.NORTH]: null,
                [Orientation.EAST]: null,
                [Orientation.SOUTH]: null,
                [Orientation.WEST]: null
            },
            walls: WALL_PALETTE,
            fallback: { id: "wall.furniture", orientation: Orientation.NORTH }
        });

        expect(match?.id).toBe("wall.furniture");
    });

    it("selects a straight wall below a single horizontal connection", () => {
        const match = matchWallPiece({
            surroundingEdges: {
                [Orientation.NORTH]: "0-2-0",
                [Orientation.EAST]: null,
                [Orientation.SOUTH]: null,
                [Orientation.WEST]: null
            },
            walls: WALL_PALETTE,
            fallback: { id: "wall.furniture", orientation: Orientation.NORTH }
        });

        expect(match?.id).toBe("wall.furniture");
    });

    it("selects a corner below the end of a horizontal run", () => {
        const match = matchWallPiece({
            surroundingEdges: {
                [Orientation.NORTH]: "0-2-0",
                [Orientation.EAST]: null,
                [Orientation.SOUTH]: null,
                [Orientation.WEST]: "0-2-0"
            },
            walls: WALL_PALETTE,
            fallback: { id: "wall.furniture", orientation: Orientation.NORTH }
        });

        expect(match?.id).toBe("corner-wall.furniture");
    });

    it("selects a horizontal wall when connecting to the west", () => {
        const match = matchWallPiece({
            surroundingEdges: {
                [Orientation.NORTH]: null,
                [Orientation.EAST]: null,
                [Orientation.SOUTH]: null,
                [Orientation.WEST]: "0-2-0"
            },
            walls: WALL_PALETTE,
            fallback: { id: "wall.furniture", orientation: Orientation.NORTH }
        });

        expect(match?.id).toBe("wall.furniture");
        expect(match?.orientation).toBe(Orientation.EAST);
    });
});
