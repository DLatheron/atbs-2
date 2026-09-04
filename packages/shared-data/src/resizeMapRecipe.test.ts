import { Orientation } from "@atbs/maths";
import { describe, expect, it } from "vitest";
import {
    getMapResizeAnchorOffsets,
    resizeMapRecipe,
    type ResizeMapTileRecipe
} from "./resizeMapRecipe.js";

function grassTile(label: string): ResizeMapTileRecipe {
    return {
        terrain: {
            id: label,
            orientation: Orientation.NORTH
        }
    };
}

describe("getMapResizeAnchorOffsets", () => {
    it("anchors to the south-west when expanding", () => {
        expect(getMapResizeAnchorOffsets("south-west", 2, 2, 4, 3)).toEqual({
            colOffset: 0,
            rowOffset: 1
        });
    });

    it("anchors to the north-east when shrinking", () => {
        expect(getMapResizeAnchorOffsets("north-east", 4, 3, 2, 2)).toEqual({
            colOffset: -2,
            rowOffset: 0
        });
    });
});

describe("resizeMapRecipe", () => {
    it("expands with south-west anchor and fills new tiles with default terrain", () => {
        const recipe = {
            width: 2,
            height: 2,
            tiles: [
                [grassTile("a"), grassTile("b")],
                [grassTile("c"), grassTile("d")]
            ]
        };

        const resized = resizeMapRecipe(recipe, {
            width: 3,
            height: 3,
            anchor: "south-west",
            defaultTerrainId: "sand.terrain",
            defaultOrientation: Orientation.EAST,
            randomiseOrientation: false
        });

        expect(resized.width).toBe(3);
        expect(resized.height).toBe(3);
        expect(resized.tiles[2][0].terrain.id).toBe("c");
        expect(resized.tiles[2][1].terrain.id).toBe("d");
        expect(resized.tiles[0][2].terrain).toEqual({
            id: "sand.terrain",
            orientation: Orientation.EAST
        });
    });

    it("shrinks with north-east anchor and keeps the top-right region", () => {
        const recipe = {
            width: 3,
            height: 3,
            tiles: [
                [grassTile("a"), grassTile("b"), grassTile("c")],
                [grassTile("d"), grassTile("e"), grassTile("f")],
                [grassTile("g"), grassTile("h"), grassTile("i")]
            ]
        };

        const resized = resizeMapRecipe(recipe, {
            width: 2,
            height: 2,
            anchor: "north-east",
            defaultTerrainId: "sand.terrain",
            defaultOrientation: Orientation.NORTH,
            randomiseOrientation: false
        });

        expect(resized.tiles).toEqual([
            [grassTile("b"), grassTile("c")],
            [grassTile("e"), grassTile("f")]
        ]);
    });
});
