import { describe, expect, it } from "vitest";
import { Vec2 } from "./Vec2.js";

describe("Vec2", () => {
    describe("constructor", () => {
        const expectedZeroVector = new Vec2({ x: 0, y: 0 });
        const expectedVector = new Vec2({ x: 1, y: 2 });

        it("should construct an empty vector", () => {
            expect(new Vec2()).toStrictEqual(expectedZeroVector);
        });

        it("should construct a vector from individual numbers", () => {
            expect(new Vec2(1, 2)).toStrictEqual(expectedVector);
        });

        it("should construct a vector from an object", () => {
            expect(new Vec2({ x: 1, y: 2 })).toStrictEqual(expectedVector);
        });

        it("should construct a vector from an array", () => {
            expect(new Vec2([1, 2])).toStrictEqual(expectedVector);
        });

        it("should parse into a class", () => {
            expect(Vec2.parse({ x: 1, y: 2 })).toStrictEqual(expectedVector);
        });

        it("should safeParse into a class", () => {
            expect(Vec2.safeParse({ x: 1, y: 2 })).toStrictEqual({
                success: true,
                data: expectedVector
            });
        });

        it("should throw if the parse fails", () => {
            expect(() => Vec2.parse({ x: "1", y: "2" })).toThrow();
        });

        it("should flag the failure if safeParse fails", () => {
            expect(Vec2.safeParse({ x: "1", y: "2" })).toStrictEqual({
                success: false,
                error: expect.any(Object)
            });
        });
    });

    describe("normalise", () => {
        it("should return a normalised vector (x major)", () => {
            expect(new Vec2(100, 0).normalise()).toStrictEqual(new Vec2(1, 0));
        });

        it("should return a normalised vector (y major)", () => {
            expect(new Vec2(0, 1000).normalise()).toStrictEqual(new Vec2(0, 1));
        });

        it("should throw a divide by zero", () => {
            expect(() => new Vec2(0, 0).normalise()).toThrowError(/^Divide by zero$/);
        });
    });

    describe("safeNormalise", () => {
        it("should return a normalised vector (x major)", () => {
            expect(new Vec2(100, 0).safeNormalise()).toStrictEqual(new Vec2(1, 0));
        });

        it("should return a normalised vector (y major)", () => {
            expect(new Vec2(0, 1000).safeNormalise()).toStrictEqual(new Vec2(0, 1));
        });

        it("should not throw a divide by zero", () => {
            expect(() => new Vec2(0, 0).safeNormalise()).not.toThrow();
        });
    });
});
