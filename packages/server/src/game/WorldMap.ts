import { ClientMap, RenderMode, MapId } from "@atbs/shared-data";
import z from "zod";
import { Tile, TileRecipe } from "./Tile.js";
import { Aabb, ITilePos, Maths, TilePos, Vec2 } from "@atbs/maths";
import { Unit } from "./Unit.js";
import { HandleMaterialPenetration } from "./Ray.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { ItemManager } from "./ItemManager.js";

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
                (tileRecipe, col) => new Tile(new TilePos(col, row), tileRecipe, furnitureManager)
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
        return this._tiles[Maths.Clamp(tilePos.row, 0, this.height - 1)][
            Maths.Clamp(tilePos.col, 0, this.width - 1)
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

    rayCastTile(
        tile: Tile,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _entryWorldPos: Vec2,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _exitWorldPos: Vec2,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _handleMaterialPenetration: HandleMaterialPenetration
    ): Vec2 | undefined {
        if (!tile.anythingCollidable) {
            return;
        }

        // const entrySubTile = this.worldToSubTile(tile.location, entryWorldPos);
        // const exitSubTile = this.worldToSubTile(tile.location, exitWorldPos);

        // const collisionImages = tile.getTileForCollision(ImageManager.GetSingleton);
        // const deltaChange = exitSubTile.sub(entrySubTile);
        // const xMajorAxis = Math.abs(deltaChange.x) >= Math.abs(deltaChange.y);
        // let xyAxis: XYAxis;
        // let calcMajorAxisStep: (majorAxisStep: number) => Vec2;
        // if (xMajorAxis) {
        //     xyAxis = { major: "x", minor: "y" };

        //     const dx = Math.sign(deltaChange.x);
        //     const dy = deltaChange.y / deltaChange.x;

        //     calcMajorAxisStep = (majorAxisStep) => {
        //         const x = majorAxisStep * dx;
        //         const y = x * dy;

        //         return entrySubTile.add({ x, y });
        //     };
        // } else {
        //     xyAxis = { major: "y", minor: "x" };

        //     const dx = deltaChange.x / deltaChange.y;
        //     const dy = Math.sign(deltaChange.y);

        //     calcMajorAxisStep = (majorAxisStep) => {
        //         const y = majorAxisStep * dy;
        //         const x = y * dx;

        //         return entrySubTile.add({ x, y });
        //     };
        // }

        // const totalSteps = Math.abs(deltaChange[xyAxis.major]);
        // const tileTopLeft = this.tileTopLeft(tile.location);
        // let trackingWorldPos;

        // for (let step = 0; step < totalSteps; ++step) {
        //     const samplePos = calcMajorAxisStep(step);

        //     trackingWorldPos = tileTopLeft.add(samplePos);

        //     let hitMaterial = false;

        //     for (const { owner, image, orientation, materials } of collisionImages) {
        //         const materialColour = image.getColour(samplePos, orientation);
        //         if (materialColour.a > 0.0) {
        //             const [material] = Material.DetermineMaterial(materialColour, materials);

        //             if (handleMaterialPenetration(trackingWorldPos, owner, material)) {
        //                 // Record the final position of the trace.
        //                 return trackingWorldPos;
        //             }

        //             hitMaterial = true;
        //             break; // NOTE: Only consider the first material that we strike!
        //         }
        //     }

        //     if (!hitMaterial) {
        //         handleMaterialPenetration(trackingWorldPos);
        //     }
        // }
    }
}
