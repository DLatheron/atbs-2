import { describe, expect, it } from "vitest";
import { rectanglesToTileKeys, tilesToMinimalRectangles } from "./tilesToMinimalRectangles.js";

describe("tilesToMinimalRectangles", () => {
    it("merges a solid rectangle into one entry", () => {
        const tiles = [
            { col: 0, row: 0 },
            { col: 1, row: 0 },
            { col: 0, row: 1 },
            { col: 1, row: 1 }
        ];

        expect(tilesToMinimalRectangles(tiles)).toEqual([{ col: 0, row: 0, width: 2, height: 2 }]);
    });

    it("merges an L-shape into two rectangles", () => {
        const tiles = [
            { col: 0, row: 0 },
            { col: 1, row: 0 },
            { col: 0, row: 1 }
        ];

        const rectangles = tilesToMinimalRectangles(tiles);
        expect(rectangles).toHaveLength(2);
        expect(rectanglesToTileKeys(rectangles).sort()).toEqual(["0,0", "0,1", "1,0"].sort());
    });
});
