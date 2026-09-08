import { describe, expect, it } from "vitest";
import { Orientation } from "@atbs/maths";
import { createDefaultSelectedTerrain, getTerrainId, rotateCompoundLayer } from "./terrainHelpers";
import type { TerrainPaletteWire } from "@atbs/shared-data";

const PALETTE = {
    terrains: [
        {
            id: "grass.terrain",
            name: "Grass",
            tileSet: "Default",
            category: "Ground",
            uiImage: [],
            allowRandomOrientation: true
        },
        {
            id: "sand.terrain",
            name: "Sand",
            tileSet: "Default",
            category: "Ground",
            uiImage: [],
            allowRandomOrientation: true
        }
    ],
    blends: [
        {
            id: "half.blend",
            name: "Half",
            uiImage: []
        }
    ]
} as TerrainPaletteWire;

describe("compound terrain layer orientation", () => {
    it("bakes each layer orientation into the compound id", () => {
        const selected = {
            ...createDefaultSelectedTerrain(),
            compoundTerrain: true,
            image1: {
                index: 0,
                orientation: Orientation.EAST,
                randomiseOrientation: false
            },
            blend: {
                index: 0,
                orientation: Orientation.SOUTH,
                randomiseOrientation: false
            },
            image2: {
                index: 1,
                orientation: Orientation.WEST,
                randomiseOrientation: false
            }
        };

        expect(getTerrainId(PALETTE, selected, true)).toBe("grass[2]_half[4]_sand[6].terrain");
    });

    it("rotates background, blend, and foreground independently", () => {
        let selected = {
            ...createDefaultSelectedTerrain(),
            compoundTerrain: true,
            image1: {
                index: 0,
                orientation: Orientation.NORTH,
                randomiseOrientation: false
            },
            image2: {
                index: 1,
                orientation: Orientation.NORTH,
                randomiseOrientation: false
            }
        };
        selected = rotateCompoundLayer(selected, "image1", 2);
        selected = rotateCompoundLayer(selected, "blend", 2);
        selected = rotateCompoundLayer(selected, "image2", -2);

        expect(selected.image1.orientation).toBe(Orientation.EAST);
        expect(selected.blend.orientation).toBe(Orientation.EAST);
        expect(selected.image2.orientation).toBe(Orientation.WEST);
        expect(getTerrainId(PALETTE, selected, true)).toBe("grass[2]_half[2]_sand[6].terrain");
    });

    it("allows transparent as background or foreground", () => {
        const paletteWithTransparent = {
            ...PALETTE,
            terrains: [
                {
                    id: "transparent.terrain",
                    name: "Transparent",
                    tileSet: "Default",
                    category: "Utility",
                    uiImage: [{ imageId: "transparent" }],
                    allowRandomOrientation: false
                },
                ...PALETTE.terrains
            ]
        } as TerrainPaletteWire;

        const selected = {
            ...createDefaultSelectedTerrain(),
            compoundTerrain: true,
            image1: {
                index: 0,
                orientation: Orientation.NORTH,
                randomiseOrientation: false
            },
            blend: {
                index: 0,
                orientation: Orientation.NORTH,
                randomiseOrientation: false
            },
            image2: {
                index: 1,
                orientation: Orientation.NORTH,
                randomiseOrientation: false
            }
        };

        expect(getTerrainId(paletteWithTransparent, selected, true)).toBe(
            "transparent[0]_half[0]_grass[0].terrain"
        );
    });
});
