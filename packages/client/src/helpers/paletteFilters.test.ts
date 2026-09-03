import { describe, expect, it } from "vitest";
import {
    PALETTE_FILTER_ALL,
    itemMatchesPaletteFilters,
    nextMultiFilterValue
} from "./paletteFilters.js";

describe("nextMultiFilterValue", () => {
    const options = ["Default", "Rebelstar"];

    it("keeps All when All is the only selection", () => {
        expect(nextMultiFilterValue([PALETTE_FILTER_ALL], [PALETTE_FILTER_ALL], options)).toEqual([
            PALETTE_FILTER_ALL
        ]);
    });

    it("replaces All with a specific option", () => {
        expect(
            nextMultiFilterValue([PALETTE_FILTER_ALL], [PALETTE_FILTER_ALL, "Rebelstar"], options)
        ).toEqual(["Rebelstar"]);
    });

    it("returns All when All is chosen over specific options", () => {
        expect(
            nextMultiFilterValue(["Rebelstar"], [PALETTE_FILTER_ALL, "Rebelstar"], options)
        ).toEqual([PALETTE_FILTER_ALL]);
    });

    it("collapses to All when every option is selected", () => {
        expect(nextMultiFilterValue(["Rebelstar"], ["Rebelstar", "Default"], options)).toEqual([
            PALETTE_FILTER_ALL
        ]);
    });
});

describe("itemMatchesPaletteFilters", () => {
    const moonbuggy = { tileSet: "Rebelstar", category: "Vehicles" };

    it("matches when All is selected", () => {
        expect(
            itemMatchesPaletteFilters(moonbuggy, [PALETTE_FILTER_ALL], [PALETTE_FILTER_ALL])
        ).toBe(true);
    });

    it("filters by tile set and category", () => {
        expect(itemMatchesPaletteFilters(moonbuggy, ["Rebelstar"], ["Vehicles"])).toBe(true);
        expect(itemMatchesPaletteFilters(moonbuggy, ["Default"], ["Vehicles"])).toBe(false);
        expect(itemMatchesPaletteFilters(moonbuggy, ["Rebelstar"], ["Walls"])).toBe(false);
    });
});
