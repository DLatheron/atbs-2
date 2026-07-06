import { describe, expect, it } from "vitest";
import { PathSegment } from "./DebugGraphics.js";
import { distancePointToSegment, minDistanceFromPointToPathSegments } from "./Path.js";

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
        expect(minDistanceFromPointToPathSegments({ x: 0, y: 0 }, [])).toBe(Number.POSITIVE_INFINITY);
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
