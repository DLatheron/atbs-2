import { describe, expect, it } from "vitest";
import { Aabb } from "./Aabb.js";
import { PathSegment } from "./DebugGraphics.js";
import {
    clipPathAfterLeavingWorld,
    distancePointToSegment,
    minDistanceFromPointToPathSegments,
    positionOnPathAtTime
} from "./Path.js";

describe("distancePointToSegment", () => {
    it("returns zero when the point lies on the segment", () => {
        expect(distancePointToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    });

    it("returns distance to the nearest endpoint when projection falls outside the segment", () => {
        expect(distancePointToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    });

    it("returns distance to the point when the segment is zero-length", () => {
        expect(distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
    });

    it("returns perpendicular distance when projection falls inside the segment", () => {
        expect(distancePointToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    });
});

describe("minDistanceFromPointToPathSegments", () => {
    it("returns infinity for an empty path", () => {
        expect(minDistanceFromPointToPathSegments({ x: 0, y: 0 }, [])).toBe(
            Number.POSITIVE_INFINITY
        );
    });

    it("returns distance to a single point", () => {
        expect(
            minDistanceFromPointToPathSegments({ x: 3, y: 4 }, [{ pos: { x: 0, y: 0 }, time: 0 }])
        ).toBe(5);
    });

    it("returns zero when the point lies on a straight path", () => {
        const segments: PathSegment[] = [
            { pos: { x: 0, y: 0 }, time: 0 },
            { pos: { x: 10, y: 0 }, time: 100 }
        ];

        expect(minDistanceFromPointToPathSegments({ x: 5, y: 0 }, segments)).toBe(0);
    });

    it("returns the minimum distance across a multi-segment ricochet-style path", () => {
        const segments: PathSegment[] = [
            { pos: { x: 0, y: 0 }, time: 0 },
            { pos: { x: 10, y: 0 }, time: 100 },
            { pos: { x: 10, y: 10 }, time: 200 }
        ];

        expect(minDistanceFromPointToPathSegments({ x: 10, y: 5 }, segments)).toBe(0);
        expect(minDistanceFromPointToPathSegments({ x: 5, y: 5 }, segments)).toBe(5);
    });
});

describe("positionOnPathAtTime", () => {
    const path: PathSegment[] = [
        { pos: { x: 0, y: 0 }, time: 0 },
        { pos: { x: 100, y: 0 }, time: 100 }
    ];

    it("clamps to the start and end of the path", () => {
        expect(positionOnPathAtTime(path, -10)).toEqual({ x: 0, y: 0 });
        expect(positionOnPathAtTime(path, 150)).toEqual({ x: 100, y: 0 });
    });

    it("interpolates along a segment", () => {
        expect(positionOnPathAtTime(path, 40)).toEqual({ x: 40, y: 0 });
    });
});

describe("clipPathAfterLeavingWorld", () => {
    const worldBounds = new Aabb(0, 0, 200, 200);

    it("leaves an on-map path unchanged", () => {
        const path: PathSegment[] = [
            { pos: { x: 10, y: 10 }, time: 0 },
            { pos: { x: 50, y: 10 }, time: 100 }
        ];

        expect(clipPathAfterLeavingWorld(path, worldBounds, 40)).toEqual(path);
    });

    it("ends the path trailLength past the world exit", () => {
        const path: PathSegment[] = [
            { pos: { x: 50, y: 50 }, time: 0 },
            { pos: { x: 5000, y: 50 }, time: 10000 }
        ];
        const clipped = clipPathAfterLeavingWorld(path, worldBounds, 40);
        const last = clipped[clipped.length - 1];

        expect(last.pos.x).toBeCloseTo(240);
        expect(last.pos.y).toBeCloseTo(50);
        expect(last.time).toBeCloseTo(((240 - 50) / (5000 - 50)) * 10000);
        expect(clipped[0]).toEqual(path[0]);
    });

    it("does not extend past the original path end", () => {
        const path: PathSegment[] = [
            { pos: { x: 190, y: 50 }, time: 0 },
            { pos: { x: 210, y: 50 }, time: 20 }
        ];
        const clipped = clipPathAfterLeavingWorld(path, worldBounds, 100);
        const last = clipped[clipped.length - 1];

        expect(last.pos.x).toBeCloseTo(210);
        expect(last.time).toBe(20);
    });
});
