import { describe, expect, it } from "vitest";
import { Orientation, TilePos, rotateOrientation } from "@atbs/maths";
import {
    getBrushDimensions,
    resolveFurnitureTileOrientation,
    resolveTileOrientation,
    rotateSample
} from "./furnitureHelpers.js";

describe("resolveFurnitureTileOrientation", () => {
    it("uses placement orientation for single-tile furniture", () => {
        expect(
            resolveFurnitureTileOrientation(Orientation.NORTH, Orientation.EAST, false)
        ).toBe(Orientation.EAST);
    });

    it("applies the same counter-rotation to every tile in a multi-tile piece", () => {
        const placementOrientation = Orientation.EAST;

        expect(
            resolveFurnitureTileOrientation(
                Orientation.NORTH,
                placementOrientation,
                true
            )
        ).toBe(resolveTileOrientation(Orientation.NORTH, placementOrientation));
        expect(
            resolveFurnitureTileOrientation(
                Orientation.NORTH,
                placementOrientation,
                true
            )
        ).toBe(rotateOrientation(Orientation.NORTH, -placementOrientation));
    });

    it("adjusts directional multi-tile parts relative to the whole placement", () => {
        expect(
            resolveFurnitureTileOrientation(Orientation.EAST, Orientation.NORTH, true)
        ).toBe(Orientation.EAST);
        expect(
            resolveFurnitureTileOrientation(Orientation.EAST, Orientation.EAST, true)
        ).toBe(Orientation.NORTH);
    });
});

describe("rotateSample", () => {
    it("permutes a 2x2 composite when the whole piece is rotated east", () => {
        const dimensions = { x: 2, y: 2 };

        expect(rotateSample({ x: 0, y: 0 }, dimensions, Orientation.EAST)).toEqual({
            x: 1,
            y: 0
        });
        expect(rotateSample({ x: 1, y: 0 }, dimensions, Orientation.EAST)).toEqual({
            x: 1,
            y: 1
        });
    });
});

describe("big-tree placement", () => {
    const palette = [
        ["big-tree-0-0", "big-tree-1-0"],
        ["big-tree-0-1", "big-tree-1-1"]
    ];

    function placeBigTree(actualOrientation: Orientation) {
        const brushSize = { x: 2, y: 2 };
        const dimensions = getBrushDimensions(brushSize, actualOrientation);
        const origin = new TilePos(8, 4);
        const placed: { pos: string; id: string; orientation: Orientation }[] = [];

        for (let y = 0; y < dimensions.y; y++) {
            for (let x = 0; x < dimensions.x; x++) {
                const sample = rotateSample({ x, y }, dimensions, actualOrientation);
                const mapPos = origin.add({ x, y });
                placed.push({
                    pos: `${mapPos.col},${mapPos.row}`,
                    id: palette[sample.y][sample.x],
                    orientation: resolveFurnitureTileOrientation(
                        Orientation.NORTH,
                        actualOrientation,
                        true
                    )
                });
            }
        }

        return placed;
    }

    it("uses the same orientation on every tile for a rotated tree", () => {
        const placed = placeBigTree(Orientation.EAST);
        const orientations = new Set(placed.map((tile) => tile.orientation));

        expect(orientations.size).toBe(1);
        expect(orientations.has(Orientation.WEST)).toBe(true);
    });

    it("permutes quadrants when the whole tree is rotated", () => {
        const placed = placeBigTree(Orientation.EAST);
        const byPos = Object.fromEntries(placed.map((tile) => [tile.pos, tile.id]));

        expect(byPos["8,4"]).toBe("big-tree-1-0");
        expect(byPos["9,4"]).toBe("big-tree-1-1");
        expect(byPos["8,5"]).toBe("big-tree-0-0");
        expect(byPos["9,5"]).toBe("big-tree-0-1");
    });
});
