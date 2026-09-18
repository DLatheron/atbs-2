import { describe, expect, it } from "vitest";
import { degreesToRadians } from "@atbs/maths";
import { TILE_DRAW_BLEED_PX, tileDrawDestRect } from "./tileDraw";

function rotateCanvas(x: number, y: number, radians: number): { x: number; y: number } {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos
    };
}

function destCorners(rect: { x: number; y: number; width: number; height: number }) {
    return [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height },
        { x: rect.x, y: rect.y + rect.height }
    ];
}

function aabb(points: { x: number; y: number }[]) {
    return {
        minX: Math.min(...points.map((point) => point.x)),
        maxX: Math.max(...points.map((point) => point.x)),
        minY: Math.min(...points.map((point) => point.y)),
        maxY: Math.max(...points.map((point) => point.y))
    };
}

describe("tileDrawDestRect", () => {
    it("is centred on the tile so overlap does not move when rotated", () => {
        const dest = tileDrawDestRect(73.3, 73.3);

        expect(dest.x + dest.width / 2).toBeCloseTo(0);
        expect(dest.y + dest.height / 2).toBeCloseTo(0);
        expect(dest.width).toBeCloseTo(73.3 + TILE_DRAW_BLEED_PX * 2);
        expect(dest.height).toBeCloseTo(dest.width);
    });

    it("covers the tile square plus bleed after 90-degree rotations", () => {
        const tileCanvasSize = 100;
        const half = tileCanvasSize / 2;
        const dest = tileDrawDestRect(tileCanvasSize, tileCanvasSize);

        for (const degrees of [0, 90, 180, 270]) {
            const rotated = destCorners(dest).map((corner) =>
                rotateCanvas(corner.x, corner.y, degreesToRadians(degrees))
            );
            const bounds = aabb(rotated);

            expect(bounds.minX).toBeLessThanOrEqual(-half - TILE_DRAW_BLEED_PX);
            expect(bounds.maxX).toBeGreaterThanOrEqual(half + TILE_DRAW_BLEED_PX);
            expect(bounds.minY).toBeLessThanOrEqual(-half - TILE_DRAW_BLEED_PX);
            expect(bounds.maxY).toBeGreaterThanOrEqual(half + TILE_DRAW_BLEED_PX);
        }
    });

    it("does not leave a gap on the shared edge the way an uncentred +1 dest does", () => {
        const tileCanvasSize = 100;
        const half = tileCanvasSize / 2;
        const uncentred = {
            x: -half,
            y: -half,
            width: tileCanvasSize + 1,
            height: tileCanvasSize + 1
        };

        const rotated = destCorners(uncentred).map((corner) =>
            rotateCanvas(corner.x, corner.y, degreesToRadians(90))
        );
        const bounds = aabb(rotated);

        // After 90° the extra pixel sits on -x / +y, so +x meets the neighbour
        // with no overlap — that edge shimmers against the black map background.
        expect(bounds.maxX).toBeCloseTo(half);
        expect(bounds.minX).toBeLessThan(-half);

        const centred = tileDrawDestRect(tileCanvasSize, tileCanvasSize);
        const centredRotated = destCorners(centred).map((corner) =>
            rotateCanvas(corner.x, corner.y, degreesToRadians(90))
        );
        const centredBounds = aabb(centredRotated);
        expect(centredBounds.maxX).toBeGreaterThan(half);
        expect(centredBounds.minX).toBeLessThan(-half);
        expect(centredBounds.maxY).toBeGreaterThan(half);
        expect(centredBounds.minY).toBeLessThan(-half);
    });
});
