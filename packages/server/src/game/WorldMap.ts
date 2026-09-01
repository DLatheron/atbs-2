import { ClientMap, EditorMapWire, RenderMode, MapId, type VisualType } from "@atbs/shared-data";
import z from "zod";
import { Tile, TileRecipe } from "./Tile.js";
import {
    Aabb,
    clamp,
    DebugGraphic,
    ITilePos,
    MaxOrientations,
    Orientation,
    rotateOrientation,
    TilePos,
    Vec2
} from "@atbs/maths";
import { PartialRecord } from "@atbs/misc";
import { Unit } from "./Unit.js";
import { GridRayTraceResult, traceGridRay, walkGridCells } from "./GridRayTrace.js";
import { Material } from "./Material.js";
import { IRayCast } from "./IRayCast.js";
import { ImageManager } from "./ImageManager.js";
import { DamageCacheManager } from "./DamageCacheManager.js";
import { CollisionSample } from "./Tile.js";
import type { ItemManager } from "./ItemManager.js";
import type { FurnitureManager } from "./FurnitureManager.js";
import type { VisibilityManager } from "./VisibilityManager.js";

/** Host that can own a WorldMap (Game or Editor). */
export interface MapHost {
    readonly itemManager: ItemManager;
    readonly furnitureManager: FurnitureManager;
    readonly visibilityManager: VisibilityManager;
}

export type VisualRayCastResult =
    | { visible: true; pos: Vec2; tile: Tile }
    | { visible: false; pos?: Vec2; tile?: Tile; material?: Material };
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
    private readonly _host: MapHost;
    private readonly _id: MapId;
    private readonly _name: string;
    private readonly _width: number;
    private readonly _height: number;
    private readonly _tileSize: number;
    private readonly _tiles: Tile[][];

    constructor(recipe: Readonly<MapRecipe>, host: MapHost) {
        this._host = host;

        this._id = recipe.id;
        this._name = recipe.name;
        this._width = recipe.width;
        this._height = recipe.height;
        this._tileSize = recipe.tileSize;

        this._tiles = recipe.tiles.map((tileRow, row) =>
            tileRow.map((tileRecipe, col) => {
                const location = new TilePos(col, row);
                const tile = new Tile(
                    location,
                    recipe.tileSize,
                    tileRecipe,
                    this._host.furnitureManager,
                    this._host.visibilityManager
                );

                tileRecipe.items?.forEach(({ id, overrides }) => {
                    const item = this._host.itemManager.newItem(id, {
                        ...overrides,
                        location
                    });
                    tile.addItem(item);
                });

                return tile;
            })
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

    toMapRecipe(): MapRecipe {
        return {
            id: this._id,
            name: this._name,
            width: this._width,
            height: this._height,
            tileSize: this._tileSize,
            tiles: this._tiles.map((row) => row.map((tile) => tile.toRecipe()))
        };
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

    /**
     * Resolve a landing tile for a thrown item. If the impact tile blocks movement,
     * walk back along the final approach segment and return the last clear tile,
     * falling back to `fallbackTilePos` when none is found.
     */
    resolveNonObstructedLandingTile(
        finalWorldPos: Vec2,
        approachFromWorldPos: Vec2,
        unitType: string,
        fallbackTilePos: TilePos
    ): Tile {
        const candidatePos = this.worldToTile(finalWorldPos);
        const candidate = this.sampleTile(candidatePos);
        if (candidate && !candidate.blocksMovement(unitType)) {
            return candidate;
        }

        let lastClear: Tile | undefined;
        for (const cellWalk of walkGridCells(approachFromWorldPos, finalWorldPos, {
            aabb: this.worldBounds,
            gridScale: this.tileSize
        })) {
            if ("outOfBounds" in cellWalk) {
                break;
            }

            const tilePos = this.worldToTile(this.worldBounds.topLeft.add(cellWalk.cellOrigin));
            const tile = this.sampleTile(tilePos);
            if (tile && !tile.blocksMovement(unitType)) {
                lastClear = tile;
            }
        }

        return lastClear ?? this.getTile(fallbackTilePos);
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

    renderGameMap(): ClientMap {
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

    renderDeploymentMap(): ClientMap {
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

    renderEditorMap(): EditorMapWire {
        const baseMap = this.renderDeploymentMap();
        const furnitureLayer = this._tiles.map((rowOfTiles) =>
            rowOfTiles.map((tile) => {
                const furnitureState = tile.getFurnitureState();
                if (!furnitureState.furnitureId) {
                    return null;
                }

                return {
                    furnitureId: furnitureState.furnitureId,
                    orientation: furnitureState.orientation ?? Orientation.NORTH
                };
            })
        );

        return {
            ...baseMap,
            furnitureLayer
        };
    }

    // renderDeploymentMap(getMarkerRenderList: (tilePos: ITilePos) => RenderList): ClientMap {
    //     const mapModeTiles = this._tiles.map((rowOfTiles, row) =>
    //         rowOfTiles.map((tile, col) => [
    //             ...tile.getRenderList({
    //                 renderMode: RenderMode.enum.MAP_MODE,
    //                 states: []
    //             }),
    //             ...getMarkerRenderList({ col, row })
    //         ])
    //     );

    //     return {
    //         width: this.width,
    //         height: this.height,
    //         tileSize: this.tileSize,
    //         tilesByRenderMode: {
    //             [RenderMode.enum.MAP_MODE]: mapModeTiles,
    //             [RenderMode.enum.FIRE_MODE]: []
    //         }
    //     };
    // }

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
    castRay(
        ray: IRayCast,
        debugGraphics?: DebugGraphic[],
        damageCache?: DamageCacheManager
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

            return tile.castRay(cellWalk.srcPos, cellWalk.dstPos, debugGraphics, damageCache);
        });
    }

    /**
     * Cast a visual LOS ray through the map, draining life by material densityMap[visualType].
     * Skips the viewer tile and succeeds as soon as the POI tile is entered (without sampling it).
     */
    castVisualRay(
        ray: IRayCast,
        visualType: VisualType,
        options: {
            skipTilePos: TilePos;
            targetTilePos: TilePos;
        },
        debugGraphics?: DebugGraphic[]
    ): VisualRayCastResult {
        const { skipTilePos, targetTilePos } = options;
        const grid = { aabb: this.worldBounds, gridScale: this.tileSize, subGrid: false };

        let reachedTarget = false;
        let targetPos: Vec2 | undefined;
        let targetTile: Tile | undefined;

        const blocked = traceGridRay(ray.srcPos, ray.dstPos, grid, (cellWalk) => {
            const tilePos = this.worldToTile(this.worldBounds.topLeft.add(cellWalk.cellOrigin));
            const tile = this.sampleTile(tilePos);
            if (!tile) {
                return undefined;
            }

            if (TilePos.IsEqual(tilePos, targetTilePos)) {
                reachedTarget = true;
                targetPos = cellWalk.cellOrigin.add(cellWalk.srcPos).add(this.worldBounds.topLeft);
                targetTile = tile;
                // Stop the walk without treating this as a material block.
                return { pos: cellWalk.srcPos, tile };
            }

            if (TilePos.IsEqual(tilePos, skipTilePos)) {
                return undefined;
            }

            return tile.castVisualRay(
                ray,
                visualType,
                cellWalk.srcPos,
                cellWalk.dstPos,
                debugGraphics
            );
        });

        if (reachedTarget && targetPos && targetTile) {
            return { visible: true, pos: targetPos, tile: targetTile };
        }

        if (blocked) {
            return {
                visible: false,
                pos: blocked.pos,
                tile: blocked.tile,
                material: blocked.material
            };
        }

        return { visible: false };
    }

    stepRay(
        ray: IRayCast,
        currentMaterial: Material,
        debugGraphics?: DebugGraphic[],
        damageCache?: DamageCacheManager,
        onMaterialPixel?: (tile: Tile, samplePos: Vec2, sample: CollisionSample) => void
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
                debugGraphics,
                damageCache,
                onMaterialPixel
                    ? (samplePos, sample) => onMaterialPixel(tile, samplePos, sample)
                    : undefined
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

    sampleMaterialAt(imageManager: ImageManager, worldPos: Vec2): Material | undefined {
        const tilePos = this.worldToTile(worldPos);
        if (this.isOutside(tilePos)) {
            return undefined;
        }

        const tile = this.getTile(tilePos);
        const subTilePos = this.worldToSubTile(tilePos, worldPos);
        const collisionLayers = tile.getCollisionLayers(imageManager);

        return Tile.SampleCollisionLayers(subTilePos, collisionLayers)?.material;
    }

    /**
     * Measures material depth at a surface hit by stepping along the inward normal until
     * the material changes or open space is reached. Uses 8-way integer steps to match
     * the surface normal sampling grid.
     */
    calcMaterialThickness(
        imageManager: ImageManager,
        worldPos: Vec2,
        normal: Vec2,
        material: Material,
        maxSamples = 256
    ): number {
        const intoMaterial = normal.scale(-1);
        const step = Vec2.StepInDirection(Vec2.nearestOrientation(intoMaterial));
        let thickness = 0;
        let samplePos = new Vec2(Math.round(worldPos.x), Math.round(worldPos.y));

        for (let i = 0; i < maxSamples; i++) {
            samplePos = samplePos.add(step);
            const sample = this.sampleMaterialAt(imageManager, samplePos);
            if (!sample || sample.id !== material.id) {
                break;
            }

            thickness++;
        }

        return Math.max(thickness, 1);
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

    getSurroundingTiles(tilePos: TilePos): PartialRecord<Orientation, Tile> {
        return {
            [Orientation.NORTH_WEST]: this.sampleTile(
                tilePos.stepInDirection(Orientation.NORTH_WEST)
            ),
            [Orientation.NORTH]: this.sampleTile(tilePos.stepInDirection(Orientation.NORTH)),
            [Orientation.NORTH_EAST]: this.sampleTile(
                tilePos.stepInDirection(Orientation.NORTH_EAST)
            ),
            [Orientation.WEST]: this.sampleTile(tilePos.stepInDirection(Orientation.WEST)),
            [Orientation.CENTER]: this.sampleTile(tilePos),
            [Orientation.EAST]: this.sampleTile(tilePos.stepInDirection(Orientation.EAST)),
            [Orientation.SOUTH_WEST]: this.sampleTile(
                tilePos.stepInDirection(Orientation.SOUTH_WEST)
            ),
            [Orientation.SOUTH]: this.sampleTile(tilePos.stepInDirection(Orientation.SOUTH)),
            [Orientation.SOUTH_EAST]: this.sampleTile(
                tilePos.stepInDirection(Orientation.SOUTH_EAST)
            )
        };
    }

    getImmediateActionTiles(
        tilePos: TilePos,
        facing: Orientation,
        viewAngleInDegrees: number
    ): PartialRecord<Orientation, Tile> {
        const surroundingTiles = this.getSurroundingTiles(tilePos);

        const halfViewAngleInDegrees = viewAngleInDegrees / 2;
        const angleInSteps = Math.ceil((halfViewAngleInDegrees / 360) * MaxOrientations);

        const leftViewConeOrientation = rotateOrientation(facing, -angleInSteps);
        const rightViewConeOrientation = rotateOrientation(facing, angleInSteps);
        const allowableOrientations = [Orientation.CENTER];

        for (
            let currentOrientation = leftViewConeOrientation;
            currentOrientation !== rightViewConeOrientation;
            currentOrientation = rotateOrientation(currentOrientation, 1)
        ) {
            allowableOrientations.push(currentOrientation);
        }
        allowableOrientations.push(rightViewConeOrientation);

        Object.keys(surroundingTiles).forEach((orientationKey) => {
            const orientation = parseInt(orientationKey) as Orientation;
            if (!allowableOrientations.includes(orientation)) {
                delete surroundingTiles[orientation];
            }
        });

        return surroundingTiles;
    }
}
