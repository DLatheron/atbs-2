import { describe, expect, it } from "vitest";
import { Mat22 } from "./Mat22.js";

describe("Mat44", () => {
    describe("constructor", () => {
        const expectedIndentityMatrix = new Mat22(1, 0, 0, 1);
        const expectedMatrix = new Mat22(1, 2, 3, 4);

        it("should construct an identity matrix", () => {
            expect(new Mat22()).toStrictEqual(expectedIndentityMatrix);
        });

        it("should construct a matrix from two vectors", () => {
            expect(new Mat22({ x: 1, y: 2 }, { x: 3, y: 4 })).toStrictEqual(expectedMatrix);
        });

        it("should construct a matrix from individual numbers", () => {
            expect(new Mat22(1, 2, 3, 4)).toStrictEqual(expectedMatrix);
        });

        it("should construct a matrix from nested arrays", () => {
            expect(
                new Mat22([
                    [1, 2],
                    [3, 4]
                ])
            ).toStrictEqual(expectedMatrix);
        });

        it("should parse into a matrix", () => {
            expect(Mat22.parse({ 0: { x: 1, y: 2 }, 1: { x: 3, y: 4 } })).toStrictEqual(
                expectedMatrix
            );
        });

        it("should safeParse into a class", () => {
            expect(Mat22.safeParse({ 0: { x: 1, y: 2 }, 1: { x: 3, y: 4 } })).toStrictEqual({
                success: true,
                data: expectedMatrix
            });
        });

        it("should throw if the parse fails", () => {
            expect(() => Mat22.parse({ 0: { x: "1", y: 2 }, 1: { x: 3, y: 4 } })).toThrow();
        });

        it("should flag the failure if safeParse fails", () => {
            expect(Mat22.safeParse({ 0: { x: "1", y: 2 }, 1: { x: 3, y: 4 } })).toStrictEqual({
                success: false,
                error: expect.any(Object)
            });
        });
    });
});
