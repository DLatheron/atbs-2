import { ClientMap, RenderMode, MapId } from "@atbs/shared-data";
import z from "zod";
import { Tile, TileRecipe } from "./Tile.js";
import { Aabb, Maths, TilePos, Vec2 } from "@atbs/maths";
import { Unit } from "./Unit.js";

export const MapRecipe = z.object({
    id: MapId,
    name: z.string().min(1),
    width: z.number().min(1).max(256),
    height: z.number().min(1).max(256),
    tileSize: z.number().min(50).max(200),
    tiles: z.array(z.array(TileRecipe))
});
export type MapRecipe = z.infer<typeof MapRecipe>;

export class WorldMap {
    private readonly _id: MapId;
    private readonly _name: string;
    private readonly _width: number;
    private readonly _height: number;
    private readonly _tileSize: number;
    private readonly _tiles: Tile[][];

    constructor(recipe: Readonly<MapRecipe>) {
        this._id = recipe.id;
        this._name = recipe.name;
        this._width = recipe.width;
        this._height = recipe.height;
        this._tileSize = recipe.tileSize;

        this._tiles = recipe.tiles.map((tileRow, row) =>
            tileRow.map((tileRecipe, col) => new Tile(new TilePos(col, row), tileRecipe))
        );
    }

    get id() {
        return this._id;
    }

    get name() {
        return this._name;
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    get tileSize() {
        return this._tileSize;
    }

    get worldBounds() {
        return new Aabb(0, 0, this.width * this.tileSize, this.height * this.tileSize);
    }

    get worldCentrePos() {
        return new Vec2((this.width * this.tileSize) / 2, (this.height * this.tileSize) / 2);
    }

    get maxVisualDistance() {
        return (
            Math.ceil(Math.sqrt(this.width * this.width + this.height * this.height)) *
            this.tileSize
        );
    }

    isOutside(tilePos: TilePos) {
        return !this.isInside(tilePos);
    }

    isInside(tilePos: TilePos) {
        return (
            tilePos.col >= 0 &&
            tilePos.col < this.width &&
            tilePos.row >= 0 &&
            tilePos.row < this.height
        );
    }

    worldToTile(worldPos: Vec2): TilePos {
        const { tileSize } = this;

        return new TilePos(Math.floor(worldPos.x / tileSize), Math.floor(worldPos.y / tileSize));
    }

    worldToTileUpper(worldPos: Vec2): TilePos {
        const { tileSize } = this;

        return new TilePos(Math.ceil(worldPos.x / tileSize), Math.ceil(worldPos.y / tileSize));
    }

    tileToWorld(tilePos: TilePos): Vec2 {
        const { tileSize } = this;

        return new Vec2(tilePos.col * tileSize, tilePos.row * tileSize);
    }

    tileCenterToWorld(tilePos: TilePos): Vec2 {
        const { tileSize } = this;
        const halfTileSize = tileSize / 2;

        return new Vec2(
            tilePos.col * tileSize + halfTileSize,
            tilePos.row * tileSize + halfTileSize
        );
    }

    getTile(tilePos: TilePos): Tile {
        if (this.isOutside(tilePos)) {
            throw new Error(`Sample at ${tilePos} is outside the map boundaries`);
        }
        return this._tiles[tilePos.row][tilePos.col];
    }

    getTileClamped(tilePos: TilePos): Tile {
        return this._tiles[Maths.Clamp(tilePos.row, 0, this.height - 1)][
            Maths.Clamp(tilePos.col, 0, this.width - 1)
        ];
    }

    sampleTile(tilePos: TilePos): Tile | undefined {
        if (
            tilePos.col < 0 ||
            tilePos.col > this.width - 1 ||
            tilePos.row < 0 ||
            tilePos.row > this.height - 1
        ) {
            return undefined;
        }
        return this._tiles[tilePos.row][tilePos.col];
    }

    renderClientMap(): ClientMap {
        const mapModeTiles = this._tiles.map((rowOfTiles) =>
            rowOfTiles.map((tile) =>
                tile.getRenderList({
                    renderMode: RenderMode.enum.MAP_MODE,
                    states: []
                })
            )
        );
        const fireModeTiles = this._tiles.map((rowOfTiles) =>
            rowOfTiles.map((tile) =>
                tile.getRenderList({
                    renderMode: RenderMode.enum.FIRE_MODE,
                    states: []
                })
            )
        );

        return {
            width: this.width,
            height: this.height,
            tileSize: this.tileSize,
            tilesByRenderMode: {
                [RenderMode.enum.MAP_MODE]: mapModeTiles,
                [RenderMode.enum.FIRE_MODE]: fireModeTiles
            }
        };
    }

    addUnit(unit: Unit) {
        if (!unit.location) {
            throw new Error(`Unit ${unit.id} does not have an assigned location`);
        }

        const tile = this.getTile(unit.location);
        tile.addUnit(unit);
    }
}
