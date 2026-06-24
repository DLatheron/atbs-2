import { describe, expect, it } from "vitest";
import { TilePos } from "./TilePos.js";

describe("TilePos", () => {
    describe("constructor", () => {
        const expectedTilePos = new TilePos({ col: 1, row: 2 });

        it("should construct a tile pos from individual numbers", () => {
            expect(new TilePos(1, 2)).toStrictEqual(expectedTilePos);
        });

        it("should construct a tile pos from an object", () => {
            expect(new TilePos({ col: 1, row: 2 })).toStrictEqual(expectedTilePos);
        });

        it("should construct a tile pos from an array", () => {
            expect(new TilePos([1, 2])).toStrictEqual(expectedTilePos);
        });

        it("should parse into a class", () => {
            expect(TilePos.parse({ col: 1, row: 2 })).toStrictEqual(expectedTilePos);
        });

        it("should safeParse into a class", () => {
            expect(TilePos.safeParse({ col: 1, row: 2 })).toStrictEqual({
                success: true,
                data: expectedTilePos
            });
        });

        it("should throw if the parse fails", () => {
            expect(() => TilePos.parse({ col: "1", row: "2" })).toThrow();
        });

        it("should flag the failure if safeParse fails", () => {
            expect(TilePos.safeParse({ col: "1", row: "2" })).toStrictEqual({
                success: false,
                error: expect.any(Object)
            });
        });
    });
});
