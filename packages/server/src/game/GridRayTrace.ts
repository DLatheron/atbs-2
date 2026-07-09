import { Aabb, Orientation, Vec2 } from "@atbs/maths";
import type { Material } from "./Material.js";
import type { Furniture } from "./Furniture.js";
import type { Unit } from "./Unit.js";
import type { Tile } from "./Tile.js";

const EPSILON = 1e-9;

export interface Grid {
    aabb: Aabb; // Projectile position of the grid.
    gridScale: number;
    subGrid: boolean;
}

export interface GridRayTraceHitResult {
    pos: Vec2;
    tile: Tile;
    material?: Material;
    /** Set when the ray leaves a material volume (exit point). */
    exitedMaterial?: Material;
    owner?: Furniture | Unit;
    imageId?: string;
    layerIndex?: number;
    orientation?: Orientation;
}
export type GridRayTraceResult = GridRayTraceHitResult | undefined;

/**
 * A ray segment clipped to a single grid cell. Positions are in cell-local space
 * using half-open bounds: `[0, gridScale)` on each axis. The minimum corner `(0, 0)`
 * is inclusive; the maximum corner at `gridScale` is exclusive.
 */
export interface GridCellWalk {
    /** Top-left corner of the cell in grid-relative coordinates */
    cellOrigin: Vec2;
    /** Clipped ray start in cell-local coordinates */
    srcPos: Vec2;
    /** Clipped ray end in cell-local coordinates */
    dstPos: Vec2;
}

export type GridCellWalkYield = GridCellWalk | { outOfBounds: true };

/**
 * Returns a hit position in cell-local coordinates and its material if a collision
 * occurred in this cell, otherwise `undefined`.
 */
export type GridCellHandler = (cellWalk: GridCellWalk) => GridRayTraceResult;

// export type GridRayTraceResult = GridHit | false | "out-of-bounds";

/**
 * Walks an integer line from `(x0, y0)` to `(x1, y1)` using Bresenham's algorithm.
 */
export function* walkBresenhamLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number
): Generator<{ x: number; y: number }, undefined, undefined> {
    let x = x0;
    let y = y0;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const stepX = x0 < x1 ? 1 : -1;
    const stepY = y0 < y1 ? 1 : -1;
    let error = dx - dy;

    for (;;) {
        yield { x, y };

        if (x === x1 && y === y1) {
            return;
        }

        const error2 = 2 * error;

        if (error2 > -dy) {
            error -= dy;
            x += stepX;
        }

        if (error2 < dx) {
            error += dx;
            y += stepY;
        }
    }
}

/**
 * Walks pixel coordinates along a clipped cell-local ray segment using Bresenham's algorithm.
 * Yields integer positions in `[0, cellSize)` on each axis.
 */
export function* walkCellBresenhamLine(
    srcPos: Vec2,
    dstPos: Vec2,
    cellSize: number
): Generator<Vec2, undefined, undefined> {
    const toPixel = (pos: Vec2) => ({
        x: Math.min(Math.max(Math.floor(pos.x), 0), cellSize - 1),
        y: Math.min(Math.max(Math.floor(pos.y), 0), cellSize - 1)
    });

    const srcPixel = toPixel(srcPos);
    const dstPixel = toPixel(dstPos);

    for (const pixel of walkBresenhamLine(srcPixel.x, srcPixel.y, dstPixel.x, dstPixel.y)) {
        yield new Vec2(pixel.x, pixel.y);
    }
}

function clipRayToGrid(
    srcPos: Vec2,
    dstPos: Vec2,
    gridAabb: Aabb
): { srcPos: Vec2; dstPos: Vec2 } | false {
    const { topLeft } = gridAabb;

    if (gridAabb.isPointInside(srcPos)) {
        return {
            srcPos: srcPos.sub(topLeft),
            dstPos: dstPos.sub(topLeft)
        };
    }

    const entryPos = gridAabb.intersectRay(srcPos, dstPos);
    if (!entryPos) {
        return false;
    }

    return {
        srcPos: entryPos.sub(topLeft),
        dstPos: dstPos.sub(topLeft)
    };
}

function isCellOriginInsideGrid(cellOrigin: Vec2, gridAabb: Aabb): boolean {
    return gridAabb.isPointInside(cellOrigin);
}

function toCellLocal(pos: Vec2, cellOrigin: Vec2, gridScale: number): Vec2 {
    const local = pos.sub(cellOrigin);
    const max = gridScale - EPSILON;

    return new Vec2(Math.min(Math.max(local.x, 0), max), Math.min(Math.max(local.y, 0), max));
}

function advancePastBoundary(
    value: number,
    step: number,
    tMax: number,
    tDelta: number,
    tStart: number
): { value: number; tMax: number } {
    while (tMax <= tStart + EPSILON) {
        value += step;
        tMax += tDelta;
    }

    return { value, tMax };
}

/**
 * Walks a ray through a uniform square grid, yielding each cell the ray passes through.
 * Each yield contains the ray clipped to that cell with coordinates in cell-local space.
 *
 * `srcPos` and `dstPos` are in world coordinates. The ray is clipped to the grid bounds
 * before walking begins.
 */
export function* walkGridCells(
    srcPos: Vec2,
    dstPos: Vec2,
    grid: Readonly<Pick<Grid, "aabb" | "gridScale">>
): Generator<GridCellWalkYield, undefined, undefined> {
    const clippedRay = clipRayToGrid(srcPos, dstPos, grid.aabb);
    if (!clippedRay) {
        return;
    }

    const { gridScale } = grid;
    const gridRelativeAabb = new Aabb(0, 0, grid.aabb.width, grid.aabb.height);
    const { srcPos: gridSrcPos, dstPos: gridDstPos } = clippedRay;
    const delta = gridDstPos.sub(gridSrcPos);

    if (!delta.isNonZero()) {
        const cellOrigin = new Vec2(
            Math.floor(gridSrcPos.x / gridScale) * gridScale,
            Math.floor(gridSrcPos.y / gridScale) * gridScale
        );

        if (!isCellOriginInsideGrid(cellOrigin, gridRelativeAabb)) {
            yield { outOfBounds: true };
            return;
        }

        const cellLocalPos = toCellLocal(gridSrcPos, cellOrigin, gridScale);
        yield {
            cellOrigin,
            srcPos: cellLocalPos,
            dstPos: cellLocalPos
        };
        return;
    }

    const stepX = Math.sign(delta.x);
    const stepY = Math.sign(delta.y);

    let cellX = Math.floor(gridSrcPos.x / gridScale);
    let cellY = Math.floor(gridSrcPos.y / gridScale);

    const nextGridLineX = (cellX + (stepX > 0 ? 1 : 0)) * gridScale;
    const nextGridLineY = (cellY + (stepY > 0 ? 1 : 0)) * gridScale;

    let tMaxX = stepX !== 0 ? (nextGridLineX - gridSrcPos.x) / delta.x : Number.POSITIVE_INFINITY;
    let tMaxY = stepY !== 0 ? (nextGridLineY - gridSrcPos.y) / delta.y : Number.POSITIVE_INFINITY;

    const tDeltaX = stepX !== 0 ? Math.abs(gridScale / delta.x) : Number.POSITIVE_INFINITY;
    const tDeltaY = stepY !== 0 ? Math.abs(gridScale / delta.y) : Number.POSITIVE_INFINITY;

    if (stepX !== 0) {
        ({ value: cellX, tMax: tMaxX } = advancePastBoundary(cellX, stepX, tMaxX, tDeltaX, 0));
    }
    if (stepY !== 0) {
        ({ value: cellY, tMax: tMaxY } = advancePastBoundary(cellY, stepY, tMaxY, tDeltaY, 0));
    }

    let tStart = 0;

    for (;;) {
        const cellOrigin = new Vec2(cellX * gridScale, cellY * gridScale);

        if (!isCellOriginInsideGrid(cellOrigin, gridRelativeAabb)) {
            yield { outOfBounds: true };
            return;
        }

        const tEnd = Math.min(tMaxX, tMaxY, 1);
        const segmentSrc = gridSrcPos.add(delta.scale(tStart));
        const segmentDst = gridSrcPos.add(delta.scale(tEnd));

        yield {
            cellOrigin,
            srcPos: toCellLocal(segmentSrc, cellOrigin, gridScale),
            dstPos: toCellLocal(segmentDst, cellOrigin, gridScale)
        };

        if (tEnd >= 1 - EPSILON) {
            const dstCellOrigin = new Vec2(
                Math.floor(gridDstPos.x / gridScale) * gridScale,
                Math.floor(gridDstPos.y / gridScale) * gridScale
            );

            if (
                !cellOrigin.isEqual(dstCellOrigin) &&
                isCellOriginInsideGrid(dstCellOrigin, gridRelativeAabb)
            ) {
                const cellLocalPos = toCellLocal(gridDstPos, dstCellOrigin, gridScale);
                yield {
                    cellOrigin: dstCellOrigin,
                    srcPos: cellLocalPos,
                    dstPos: cellLocalPos
                };
            }

            return;
        }

        tStart = tEnd;

        if (tMaxX < tMaxY - EPSILON) {
            cellX += stepX;
            tMaxX += tDeltaX;
        } else if (tMaxY < tMaxX - EPSILON) {
            cellY += stepY;
            tMaxY += tDeltaY;
        } else {
            cellX += stepX;
            cellY += stepY;
            tMaxX += tDeltaX;
            tMaxY += tDeltaY;
        }
    }
}

/**
 * Traces a ray through a uniform square grid, invoking `cellHandler` for each cell visited.
 * Returns the world position and material of the first collision, `undefined` if no collision
 * occurred.
 */
export function traceGridRay(
    srcPos: Vec2,
    dstPos: Vec2,
    grid: Readonly<Grid>,
    cellHandler: GridCellHandler
): GridRayTraceResult {
    const { topLeft } = grid.aabb;

    for (const cellWalk of walkGridCells(srcPos, dstPos, grid)) {
        if ("outOfBounds" in cellWalk) {
            return;
        }

        const hit = cellHandler(cellWalk);
        if (hit) {
            return {
                ...hit,
                pos: cellWalk.cellOrigin.add(hit.pos).add(topLeft)
            };
        }
    }

    return;
}
