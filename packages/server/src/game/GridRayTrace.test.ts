import { beforeEach, describe, expect, it, vi } from "vitest";
import { Aabb, Vec2 } from "@atbs/maths";
import { Grid } from "./GridHelpers.js";
import { Material } from "./Material.js";
import { traceGridRay, walkGridCells } from "./GridRayTrace.js";

describe("GridRayTrace", () => {
    let grid: Grid;
    let material: Material;

    beforeEach(() => {
        grid = { aabb: new Aabb(0, 0, 10, 10), gridScale: 1, subGrid: false };
        material = vi.mocked(Material);
    });

    function collectCellWalks(srcPos: Vec2, dstPos: Vec2) {
        const walks: Array<{
            cellOrigin: Vec2;
            srcPos: Vec2;
            dstPos: Vec2;
        }> = [];

        let outOfBounds = false;

        for (const cellWalk of walkGridCells(srcPos, dstPos, grid)) {
            if ("outOfBounds" in cellWalk) {
                outOfBounds = true;
                break;
            }

            walks.push({
                cellOrigin: cellWalk.cellOrigin,
                srcPos: cellWalk.srcPos,
                dstPos: cellWalk.dstPos
            });
        }

        return { walks, outOfBounds };
    }

    describe("walkGridCells", () => {
        it("should visit diagonal cells with cell-local clipped rays", () => {
            const { walks } = collectCellWalks(new Vec2(0, 0), new Vec2(9, 9));

            expect(walks).toHaveLength(10);
            expect(walks[0].cellOrigin).toEqual(new Vec2(0, 0));
            expect(walks[0].srcPos).toEqual(new Vec2(0, 0));
            expect(walks[0].dstPos.x).toBeLessThan(1);
            expect(walks[0].dstPos.y).toBeLessThan(1);
            expect(walks[0].dstPos.x).toBeCloseTo(1, 5);
            expect(walks[0].dstPos.y).toBeCloseTo(1, 5);
            expect(walks[9]).toEqual({
                cellOrigin: new Vec2(9, 9),
                srcPos: new Vec2(0, 0),
                dstPos: new Vec2(0, 0)
            });
        });

        it("should visit horizontal cells", () => {
            const { walks } = collectCellWalks(new Vec2(-5, 4), new Vec2(5, 4));

            expect(walks.map((walk) => walk.cellOrigin)).toEqual([
                new Vec2(0, 4),
                new Vec2(1, 4),
                new Vec2(2, 4),
                new Vec2(3, 4),
                new Vec2(4, 4),
                new Vec2(5, 4)
            ]);

            expect(walks[0].srcPos).toEqual(new Vec2(0, 0));
            expect(walks[0].dstPos.x).toBeLessThan(1);
            expect(walks[0].dstPos.y).toBe(0);
            expect(walks[0].dstPos.x).toBeCloseTo(1, 5);
        });

        it("should clip rays that start outside the grid", () => {
            const { walks } = collectCellWalks(new Vec2(-8, -8), new Vec2(5, 5));

            expect(walks[0].cellOrigin).toEqual(new Vec2(0, 0));
            expect(walks[walks.length - 1].cellOrigin).toEqual(new Vec2(5, 5));
        });

        it("should yield out-of-bounds when the ray exits the grid", () => {
            const { walks, outOfBounds } = collectCellWalks(new Vec2(0, 0), new Vec2(15, 15));

            expect(outOfBounds).toBe(true);
            expect(walks.map((walk) => walk.cellOrigin)).toEqual([
                new Vec2(0, 0),
                new Vec2(1, 1),
                new Vec2(2, 2),
                new Vec2(3, 3),
                new Vec2(4, 4),
                new Vec2(5, 5),
                new Vec2(6, 6),
                new Vec2(7, 7),
                new Vec2(8, 8),
                new Vec2(9, 9)
            ]);
        });

        it("should keep cell-local coordinates inside half-open cell bounds", () => {
            const largeCellGrid: Grid = {
                aabb: new Aabb(0, 0, 100, 100),
                gridScale: 100,
                subGrid: false
            };

            for (const cellWalk of walkGridCells(
                new Vec2(0, 0),
                new Vec2(250, 50),
                largeCellGrid
            )) {
                if ("outOfBounds" in cellWalk) {
                    break;
                }

                expect(cellWalk.srcPos.x).toBeGreaterThanOrEqual(0);
                expect(cellWalk.srcPos.y).toBeGreaterThanOrEqual(0);
                expect(cellWalk.dstPos.x).toBeGreaterThanOrEqual(0);
                expect(cellWalk.dstPos.y).toBeGreaterThanOrEqual(0);
                expect(cellWalk.srcPos.x).toBeLessThan(100);
                expect(cellWalk.srcPos.y).toBeLessThan(100);
                expect(cellWalk.dstPos.x).toBeLessThan(100);
                expect(cellWalk.dstPos.y).toBeLessThan(100);
            }
        });

        it("should yield nothing when the ray misses the grid", () => {
            expect(collectCellWalks(new Vec2(-5, -5), new Vec2(-1, -1)).walks).toEqual([]);
        });
    });

    describe("traceGridRay", () => {
        it("should return the first collision in world coordinates", () => {
            const hit = traceGridRay(new Vec2(0, 0), new Vec2(9, 9), grid, (cellWalk) => {
                if (cellWalk.cellOrigin.isEqual(new Vec2(2, 2))) {
                    return { pos: new Vec2(0.25, 0.75), material };
                }
            });

            expect(hit).toEqual({
                worldPos: new Vec2(2.25, 2.75),
                material
            });
        });

        it("should return false when no collision occurs", () => {
            expect(traceGridRay(new Vec2(0, 0), new Vec2(4, 4), grid, () => undefined)).toBe(false);
        });

        it("should return out-of-bounds when the ray exits without colliding", () => {
            expect(traceGridRay(new Vec2(0, 0), new Vec2(15, 15), grid, () => undefined)).toBe(
                "out-of-bounds"
            );
        });
    });
});
