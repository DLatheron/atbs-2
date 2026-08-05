import { describe, expect, it } from "vitest";
import { selectiveMerge } from "./selectiveMerge.js";

describe("selectiveMerge", () => {
    it("deep-merges nested objects by default", () => {
        const target = {
            id: "a",
            attributes: { actionPoints: { value: 5, max: 10 }, speed: { value: 1, max: 2 } },
            name: "unit"
        };
        const source = {
            attributes: { actionPoints: { value: 3 } }
        };

        const result = selectiveMerge(target, source);

        expect(result).toStrictEqual({
            id: "a",
            attributes: { actionPoints: { value: 3, max: 10 }, speed: { value: 1, max: 2 } },
            name: "unit"
        });
        expect(result).not.toBe(target);
    });

    it("treats explicit 'merge' the same as the default", () => {
        const target = { grid: { a: 1, b: 2 }, name: "old" };
        const source = { grid: { b: 9 }, name: "new" };

        expect(selectiveMerge(target, source, { grid: "merge" })).toStrictEqual({
            grid: { a: 1, b: 9 },
            name: "new"
        });
    });

    it("replaces a field wholesale when mode is 'replace'", () => {
        const target = {
            unitActionGrid: { north: ["move"], south: ["fire", "move"] },
            name: "captain"
        };
        const source = {
            unitActionGrid: { north: ["open"] },
            name: "captain-smith"
        };

        const result = selectiveMerge(target, source, { unitActionGrid: "replace" });

        expect(result).toStrictEqual({
            unitActionGrid: { north: ["open"] },
            name: "captain-smith"
        });
        expect(result.unitActionGrid).toBe(source.unitActionGrid);
    });

    it("replaces arrays instead of concatenating or merging by index", () => {
        const target = { tags: ["a", "b", "c"], count: 1 };
        const source = { tags: ["x"] };

        expect(selectiveMerge(target, source, { tags: "replace" })).toStrictEqual({
            tags: ["x"],
            count: 1
        });
    });

    it("deep-merges arrays by index when mode is default/merge", () => {
        const target = { tags: ["a", "b", "c"], count: 1 };
        const source = { tags: ["x"] };

        expect(selectiveMerge(target, source)).toStrictEqual({
            tags: ["x", "b", "c"],
            count: 1
        });
    });

    it("leaves unspecified target fields untouched when absent from source", () => {
        const target = {
            unitActionGrid: { north: ["move"] },
            name: "captain"
        };
        const source = { name: "updated" };

        expect(selectiveMerge(target, source, { unitActionGrid: "replace" })).toStrictEqual({
            unitActionGrid: { north: ["move"] },
            name: "updated"
        });
    });

    it("can mix merge and replace modes across fields", () => {
        const target = {
            nested: { keep: true, value: 1 },
            list: [1, 2, 3],
            label: "old"
        };
        const source = {
            nested: { value: 2 },
            list: [9],
            label: "new"
        };

        expect(selectiveMerge(target, source, { nested: "merge", list: "replace" })).toStrictEqual({
            nested: { keep: true, value: 2 },
            list: [9],
            label: "new"
        });
    });
});
