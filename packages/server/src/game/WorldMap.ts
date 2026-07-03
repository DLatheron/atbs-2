import { ClientMap, RenderMode, MapId } from "@atbs/shared-data";
import z from "zod";
import { Tile, TileRecipe } from "./Tile.js";
import { Aabb, clamp, DebugGraphic, ITilePos, Orientation, TilePos, Vec2 } from "@atbs/maths";
import { Unit } from "./Unit.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { ItemManager } from "./ItemManager.js";
import { GridRayTraceResult, traceGridRay } from "./GridRayTrace.js";
import { Material } from "./Material.js";
import { IRayCast } from "./IRayCast.js";
import { ImageManager } from "./ImageManager.js";

export const MapRecipe = z.object({
    id: MapId,
    name: z.string().nonempty(),
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

    constructor(
        recipe: Readonly<MapRecipe>,
        _itemManager: ItemManager,
        furnitureManager: FurnitureManager
    ) {
        this._id = recipe.id;
        this._name = recipe.name;
        this._width = recipe.width;
        this._height = recipe.height;
        this._tileSize = recipe.tileSize;

        this._tiles = recipe.tiles.map((tileRow, row) =>
            tileRow.map(
                (tileRecipe, col) =>
                    new Tile(new TilePos(col, row), recipe.tileSize, tileRecipe, furnitureManager)
            )
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

    worldToSubTile(tilePos: TilePos, worldPos: Vec2) {
        const tileTopLeft = tilePos.scale(this.tileSize);

        return new Vec2(worldPos).sub(tileTopLeft).clamp({
            min: { x: 0, y: 0 },
            max: { x: this.tileSize, y: this.tileSize }
        });
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
        return this._tiles[clamp(tilePos.row, 0, this.height - 1)][
            clamp(tilePos.col, 0, this.width - 1)
        ];
    }

    sampleTile(tilePos: ITilePos): Tile | undefined {
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

    tileTopLeft(tilePos: TilePos) {
        return this.tileOffsetToWorld(tilePos, new Vec2({ x: 0, y: 0 }));
    }

    tileOffsetToWorld(
        tilePos: TilePos,
        tileOffset: Vec2 = new Vec2(this.tileSize / 2, this.tileSize / 2)
    ) {
        return new Vec2(
            tilePos.col * this.tileSize + tileOffset.x,
            tilePos.row * this.tileSize + tileOffset.y
        );
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

    /**
     * Cast a projectile through the map until its first collision.
     * @param ray The projectile to cast.
     * @param debugGraphics Optional array for recording intersections and collisions.
     * @returns The position and material first hit, or `undefined` if no collision occurs.
     */
    castRay(ray: IRayCast, debugGraphics?: DebugGraphic[]): GridRayTraceResult {
        const grid = { aabb: this.worldBounds, gridScale: this.tileSize, subGrid: false };
        // let sampleOrder = 0;

        return traceGridRay(ray.srcPos, ray.dstPos, grid, (cellWalk) => {
            const tilePos = this.worldToTile(this.worldBounds.topLeft.add(cellWalk.cellOrigin));
            const tile = this.sampleTile(tilePos);
            if (!tile) {
                return undefined;
            }

            // debugGraphics?.push(
            //     {
            //         type: DebugGraphicType.enum.tile,
            //         tilePos: tile.location,
            //         fillColour: new Colour({ ...Colour.Green, a: 0.05 }),
            //         strokeColour: new Colour({ ...Colour.Yellow, a: 0.05 })
            //     },
            //     {
            //         type: DebugGraphicType.enum.text,
            //         worldPos: this.tileOffsetToWorld(tile.location, new Vec2(2, 10)),
            //         text: `${sampleOrder++}: ${tile.location}`,
            //         colour: Colour.White,
            //         fontSize: 10
            //     }
            // );

            return tile.castRay(cellWalk.srcPos, cellWalk.dstPos, debugGraphics);
        });
    }

    stepRay(
        ray: IRayCast,
        currentMaterial: Material,
        debugGraphics?: DebugGraphic[]
    ): GridRayTraceResult {
        const grid = { aabb: this.worldBounds, gridScale: this.tileSize, subGrid: false };
        // let sampleOrder = 0;

        return traceGridRay(ray.srcPos, ray.dstPos, grid, (cellWalk) => {
            const tilePos = this.worldToTile(this.worldBounds.topLeft.add(cellWalk.cellOrigin));
            const tile = this.sampleTile(tilePos);
            if (!tile) {
                return undefined;
            }

            // debugGraphics?.push(
            //     {
            //         type: DebugGraphicType.enum.tile,
            //         tilePos: tile.location,
            //         fillColour: new Colour({ ...Colour.Green, a: 0.05 }),
            //         strokeColour: new Colour({ ...Colour.Yellow, a: 0.05 })
            //     },
            //     {
            //         type: DebugGraphicType.enum.text,
            //         worldPos: this.tileOffsetToWorld(tile.location, new Vec2(2, 10)),
            //         text: `${sampleOrder++}: ${tile.location}`,
            //         colour: Colour.White,
            //         fontSize: 10
            //     }
            // );

            const collisionResult = tile.stepRay(
                ray,
                cellWalk.srcPos,
                cellWalk.dstPos,
                currentMaterial,
                debugGraphics
            );
            if (collisionResult) {
                return collisionResult;
            }
        });
    }

    private _sampleWorldPosForCollision(imageManager: ImageManager, worldPos: Vec2) {
        const tilePos = this.worldToTile(worldPos);
        const tile = this.getTile(tilePos);
        const collisionImages = tile.getCollisionLayers(imageManager);
        const subTilePos = this.worldToSubTile(tilePos, worldPos);

        for (const { image, orientation } of collisionImages) {
            const materialColour = image.getColour(subTilePos, orientation);
            if (materialColour.a > 0.0) {
                return true;
            }
        }

        return false;
    }

    calcNormal(imageManager: ImageManager, worldPos: Vec2): Vec2 | undefined {
        const directionSamples = [
            Orientation.NORTH,
            Orientation.NORTH_EAST,
            Orientation.EAST,
            Orientation.SOUTH_EAST,
            Orientation.SOUTH,
            Orientation.SOUTH_WEST,
            Orientation.WEST,
            Orientation.NORTH_WEST
        ];

        const normal = directionSamples.reduce((normal, direction) => {
            const samplePos = worldPos.add(Vec2.StepInDirection(direction));
            const collision = this._sampleWorldPosForCollision(imageManager, samplePos);
            if (!collision) {
                normal = normal.add(Vec2.StepInDirection(direction));
            }
            return normal;
        }, new Vec2());

        if (normal.lengthSqrd === 0) {
            return;
        }

        const resolvedNormal = normal.normalise();

        return resolvedNormal;
    }
}
