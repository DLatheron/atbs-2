import {
    Aabb,
    calcPixelPenetrationCost,
    Colour,
    DebugGraphic,
    DebugGraphicType,
    type DebugTile,
    type IColour,
    IVec2,
    Orientation,
    TilePos,
    Vec2
} from "@atbs/maths";
import { ItemId, SceneContext, UnitActionType } from "@atbs/shared-data";
import z from "zod";
import { Terrain } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { IRenderableEntity } from "./IRenderableEntity.js";
import {
    FurnitureState,
    InterestMask,
    RenderImage,
    RenderList,
    RenderMode,
    TileInfo,
    TileUpdate,
    TimedTileUpdate,
    type VisualType
} from "@atbs/shared-data";
import { Unit } from "./Unit.js";
import { Furniture, WorldActionInstance } from "./Furniture.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { Material } from "./Material.js";
import { Image } from "./Image.js";
import { ImageManager } from "./ImageManager.js";
import { GridRayTraceResult, walkCellBresenhamLine } from "./GridRayTrace.js";
import { IRayCast } from "./IRayCast.js";
import { Logger } from "@atbs/misc";
import { config } from "../config/config.schema.js";
import { DamageCacheManager } from "./DamageCacheManager.js";
import { Item } from "./Item.js";
import { ItemOverrides } from "./ItemRecipe.js";
import type { VisibilityPoi } from "./VisibilityPoi.js";
import type { VisibilityRay } from "./VisibilityRay.js";
import type { VisibilityManager } from "./VisibilityManager.js";
import { Vfx } from "./Vfx.js";
import { IMPENETRABLE } from "./Obstruction.js";

export interface CollisionSample {
    material: Material;
    owner: Furniture | Unit | Vfx;
    imageId: string;
    layerIndex: number;
    orientation: Orientation;
}

export const TileRecipe = z.object({
    terrain: z.object({
        id: z.string(),
        orientation: z.enum(Orientation).optional()
    }),
    furniture: z
        .object({
            id: z.string(),
            orientation: z.enum(Orientation).optional(),
            state: FurnitureState.optional()
        })
        .optional(),
    items: z
        .array(
            z.object({
                id: ItemId,
                overrides: ItemOverrides.optional()
            })
        )
        .optional()
    // units: z
    //     .array(
    //         z.object({
    //             id: z.string(),
    //             overrides: UnitRecipe.partial()
    //         })
    //     )
    //     .optional(),
    // markers: z
    //     .object({
    //         "deploy-1": z.boolean().optional(),
    //         "deploy-2": z.boolean().optional(),
    //         "safe-1": z.boolean().optional(),
    //         "safe-2": z.boolean().optional()
    //     })
    //     .optional()
});
export type TileRecipe = z.infer<typeof TileRecipe>;

export interface LayerCollision {
    owner: Furniture | Unit | Vfx;
    image: Image;
    imageId: string;
    layerIndex: number;
    orientation: Orientation;
    materials: Material[];
}

export class Tile implements IRenderableEntity, VisibilityPoi {
    readonly logger: Logger;

    protected _location: TilePos;
    protected _aabb: Aabb;
    protected _tileSize: number;
    protected readonly _terrain: Terrain;
    protected readonly _furniture?: Furniture;
    protected _items: Item[];
    protected _units: Unit[];
    protected _vfx: Vfx[];

    private readonly _visibilityManager: VisibilityManager;

    constructor(
        location: TilePos,
        tileSize: number,
        recipe: Readonly<TileRecipe>,
        furnitureManager: FurnitureManager,
        visibilityManager: VisibilityManager
    ) {
        this.logger = new Logger(`Tile-${location}`, config.logLevels?.tile);

        this._location = location;
        this._aabb = new Aabb(location.col * tileSize, location.row * tileSize, tileSize, tileSize);
        this._tileSize = tileSize;
        this._terrain = TerrainManager.GetSingleton().get(recipe.terrain.id);
        this._furniture = recipe.furniture
            ? furnitureManager.newFurniture(recipe.furniture.id, {
                  location,
                  orientation: recipe.furniture.orientation,
                  state: recipe.furniture.state
              })
            : undefined;
        this._items = [];
        this._units = [];
        this._vfx = [];
        this._visibilityManager = visibilityManager;
    }

    get terrain(): Terrain {
        return this._terrain;
    }

    get furniture(): Furniture | undefined {
        return this._furniture;
    }

    get units(): Unit[] {
        return this._units;
    }

    get items(): Item[] {
        return this._items;
    }

    get vfx(): Vfx[] {
        return this._vfx;
    }

    get topmostUnit(): Unit | null {
        return this._units[0] ?? null;
    }

    get topmostItem(): Item | null {
        return this._items[0] ?? null;
    }

    get location(): TilePos {
        return this._location;
    }

    get interestMasks(): InterestMask[] {
        return [
            ...(this.topmostItem ? ["items"] : []),
            ...(this.topmostUnit ? [this.topmostUnit.side.id] : []),
            ...(this.vfx.length > 0 ? ["vfx"] : [])
        ];
    }

    get aabb(): Aabb {
        return this._aabb;
    }

    get isDirectional(): boolean {
        return false;
    }

    get orientation(): Orientation {
        return Orientation.NORTH;
    }

    get overtaking(): boolean {
        return !!this.topmostUnit;
    }

    intersectsRay(ray: VisibilityRay): Vec2 | undefined {
        return this._aabb.intersectRay(ray.srcPos, ray.dstPos);
    }

    addUnit(unit: Unit): void {
        if (!unit.location) {
            throw new Error(`Unit ${unit.id} does not have an assigned location`);
        }
        if (!TilePos.IsEqual(unit.location, this.location)) {
            throw new Error(
                `Unit ${unit.id} has location ${unit.location} but is attempting to be added to ${this.location}!`
            );
        }

        this._units.unshift(unit);

        this._updateTilePoi();
    }

    removeUnit(unit: Unit): void {
        if (!unit.location) {
            throw new Error(`Unit ${unit.id} does not have an assigned location`);
        }
        if (!TilePos.IsEqual(unit.location, this.location)) {
            throw new Error(
                `Unit ${unit.id} has location ${unit.location} but is attempting to be removed from ${this.location}!`
            );
        }

        this._units = this._units.filter(({ id }) => id !== unit.id);

        this._updateTilePoi();
    }

    addItem(item: Item): void {
        if (!item.location) {
            throw new Error(`Item ${item.id} does not have an assigned location`);
        }
        if (!TilePos.IsEqual(item.location, this.location)) {
            throw new Error(
                `Item ${item.id} has location ${item.location} but is attempting to be added to ${this.location}!`
            );
        }

        this._items.unshift(item);
        this._items.sort((a, b) => a.weight - b.weight);

        this._updateTilePoi();
    }

    removeItem(item: Item): void {
        if (!item.location) {
            throw new Error(`Item ${item.id} does not have an assigned location`);
        }
        if (!TilePos.IsEqual(item.location, this.location)) {
            throw new Error(
                `Item ${item.id} has location ${item.location} but is attempting to be removed from ${this.location}!`
            );
        }

        this._items = this._items.filter(({ id }) => id !== item.id);

        this._updateTilePoi();
    }

    addVfx(vfx: Vfx): void {
        this._vfx.unshift(vfx);

        this._updateTilePoi();
    }

    removeVfx(vfx: Vfx): void {
        this._vfx = this._vfx.filter(({ id }) => id !== vfx.id);

        this._updateTilePoi();
    }

    getRenderList(context: SceneContext, damageCache?: DamageCacheManager): RenderList {
        return [
            ...this.terrain.getRenderList(context),
            ...(this.furniture?.getRenderList(context, damageCache) ?? []),
            ...this.items.map((item) => item.getRenderList(context)).flat(),
            ...this.units.map((unit) => unit.getRenderList(context)).flat(),
            ...this.vfx.map((vfx) => vfx.getRenderList(context)).flat()
        ];
    }

    /**
     * Mirrors {@link getRenderList} but omits units and appends an injected render image
     * (e.g. an `anim-` placeholder that the client resolves to an animation). Used to
     * replace a dying unit's static sprite with its death spin animation.
     */
    getRenderListExcludingUnits(
        context: SceneContext,
        injectedImage: RenderImage,
        damageCache?: DamageCacheManager
    ): RenderList {
        return [
            ...this.terrain.getRenderList(context),
            ...(this.furniture?.getRenderList(context, damageCache) ?? []),
            ...this.items.map((item) => item.getRenderList(context)).flat(),
            ...this.vfx.map((vfx) => vfx.getRenderList(context)).flat(),
            injectedImage
        ];
    }

    getTileInfo(): TileInfo {
        const { terrain, furniture, topmostItem, topmostUnit } = this;

        return {
            tilePos: this._location,
            terrain: {
                name: terrain.name,
                uiImage: terrain.getRenderList({
                    renderMode: RenderMode.enum.UI_MODE,
                    states: []
                }),
                description: terrain.description
            },
            ...(furniture && {
                furniture: {
                    name: furniture.name,
                    uiImage: furniture.getRenderList({
                        renderMode: RenderMode.enum.UI_MODE,
                        states: [furniture.state]
                    }),
                    description: furniture.description,
                    integrity: furniture.integrity
                }
            }),
            ...(topmostItem && {
                item: {
                    name: topmostItem.name,
                    uiImage: topmostItem.getRenderList({
                        renderMode: RenderMode.enum.UI_MODE,
                        states: []
                    }),
                    description: topmostItem.description
                }
            }),
            ...(topmostUnit && {
                unit: {
                    name: topmostUnit.name,
                    uiImage: topmostUnit.getRenderList({
                        renderMode: RenderMode.enum.UI_MODE,
                        states: []
                    }),
                    description: topmostUnit.description
                },
                ...(topmostUnit.itemInUse && {
                    unitUsing: {
                        name: topmostUnit.itemInUse.name,
                        uiImage: topmostUnit.itemInUse.getRenderList({
                            renderMode: RenderMode.enum.UI_MODE,
                            states: []
                        }),
                        description: topmostUnit.itemInUse.description
                    }
                })
            })
        };
    }

    get anythingCollidable() {
        return this.furniture || this.units.length > 0 || this.vfx.length > 0;
    }

    toDebugGraphic(
        fillColour?: IColour,
        strokeColour?: IColour,
        strokeThickness?: number
    ): DebugTile {
        return {
            type: DebugGraphicType.enum.tile,
            tilePos: this.location,
            fillColour,
            strokeColour,
            strokeThickness
        };
    }

    getCollisionLayers(
        imageManager: ImageManager,
        damageCache?: DamageCacheManager,
        options?: { includeVfx?: boolean }
    ): LayerCollision[] {
        const collisionLayers: LayerCollision[] = [];

        const context: SceneContext = {
            renderMode: RenderMode.enum.FIRE_MODE,
            states: []
        };

        if (this.furniture) {
            const { materials } = this.furniture;

            this.furniture.getRenderList(context).forEach((layerImage, layerIndex) => {
                if (layerImage.imageId && !layerImage.imageId.startsWith("anim-")) {
                    const originalImageId = layerImage.imageId;
                    const displayImageId = damageCache
                        ? damageCache.getImageIdOverride(originalImageId, this.location)
                        : originalImageId;

                    collisionLayers.push({
                        owner: this.furniture!,
                        image: imageManager.getImage(displayImageId),
                        imageId: originalImageId,
                        layerIndex,
                        orientation: layerImage.orientation ?? Orientation.NORTH,
                        materials
                    });
                }
            });
        }

        this.units.forEach((unit) => {
            const { materials } = unit;

            unit.getRenderList(context).forEach((layerImage, layerIndex) => {
                if (layerImage.imageId && !layerImage.imageId.startsWith("anim-")) {
                    collisionLayers.push({
                        owner: unit,
                        image: imageManager.getImage(layerImage.imageId),
                        imageId: layerImage.imageId,
                        layerIndex,
                        orientation: layerImage.orientation ?? Orientation.NORTH,
                        materials
                    });
                }
            });
        });

        if (options?.includeVfx) {
            this.vfx.forEach((vfx, layerIndex) => {
                const { materials, collisionImageId } = vfx;
                if (!collisionImageId || materials.length === 0) {
                    return;
                }

                collisionLayers.push({
                    owner: vfx,
                    image: imageManager.getImage(collisionImageId),
                    imageId: collisionImageId,
                    layerIndex,
                    orientation: Orientation.NORTH,
                    materials
                });
            });
        }

        return collisionLayers;
    }

    /**
     * Casts a ray through a tile.
     * @param subTileSrcPos The source of the ray (in local tile space). This should be inside the tile.
     * @param subTileDstPos The destination of the ray (in local tile space). This is not necessarily inside the tile.
     * @param debugGraphics Optional array for recording intersections and collisions.
     * @returns The position and material first hit, or `undefined` if no collision occurs.
     */
    castRay(
        subTileSrcPos: Vec2,
        subTileDstPos: Vec2,
        debugGraphics?: DebugGraphic[],
        damageCache?: DamageCacheManager
    ): GridRayTraceResult {
        this.logger.info("Casting against tile");

        if (!this.anythingCollidable) {
            this.logger.info("  - Contains nothing collidable");
            return;
        }

        const collisionLayers = this.getCollisionLayers(ImageManager.GetSingleton(), damageCache);
        if (collisionLayers.length === 0) {
            this.logger.info("  - Has no collision layers (but is collidable?");
            return;
        }

        for (const samplePos of walkCellBresenhamLine(
            subTileSrcPos,
            subTileDstPos,
            this._tileSize
        )) {
            this.logger.info(`  - ${samplePos} - sampling...`);

            const collisionSample = Tile.SampleCollisionLayers(samplePos, collisionLayers);
            if (collisionSample) {
                const { material, owner, imageId, layerIndex } = collisionSample;
                this.logger.info(`    - hit material ${material.id}: ${material.rgb}`);

                debugGraphics?.push(
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 8,
                        colour: Colour.White
                    },
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 6,
                        colour: new Colour({ ...material.rgb!, a: 1 })
                    }
                );

                return {
                    pos: samplePos,
                    material,
                    tile: this,
                    owner,
                    imageId,
                    layerIndex,
                    orientation: collisionSample.orientation
                };
            }
        }
    }

    /**
     * Casts a visual LOS ray through this tile, draining ray life by material densityMap[visualType].
     * Does not damage materials. Returns a hit when life is exhausted; otherwise undefined.
     */
    castVisualRay(
        ray: IRayCast,
        visualType: VisualType,
        subTileSrcPos: Vec2,
        subTileDstPos: Vec2,
        debugGraphics?: DebugGraphic[]
    ): GridRayTraceResult {
        this.logger.info("Casting visual ray against tile");

        if (!this.anythingCollidable) {
            this.logger.info("  - Contains nothing collidable");
            return;
        }

        const collisionLayers = this.getCollisionLayers(ImageManager.GetSingleton(), undefined, {
            includeVfx: true
        });
        if (collisionLayers.length === 0) {
            this.logger.info("  - Has no collision layers (but is collidable?");
            return;
        }

        for (const samplePos of walkCellBresenhamLine(
            subTileSrcPos,
            subTileDstPos,
            this._tileSize
        )) {
            this.logger.info(`  - ${samplePos} - sampling...`);

            const collisionSample = Tile.SampleCollisionLayers(samplePos, collisionLayers);
            if (!collisionSample) {
                continue;
            }

            const { material, owner, imageId, layerIndex, orientation } = collisionSample;
            const pixelCost = material.getDensityForType(visualType);
            ray.life -= pixelCost;

            this.logger.info(
                `    - hit material ${material.id} (cost ${pixelCost}, life ${ray.life})`
            );

            if (!ray.isRayAlive) {
                debugGraphics?.push(
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 8,
                        colour: Colour.White
                    },
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 6,
                        colour: new Colour({ ...Colour.Red, a: 1 })
                    }
                );

                return {
                    pos: samplePos,
                    material,
                    tile: this,
                    owner,
                    imageId,
                    layerIndex,
                    orientation
                };
            }
        }
    }

    stepRay(
        ray: IRayCast,
        subTileSrcPos: Vec2,
        subTileDstPos: Vec2,
        currentMaterial: Material,
        debugGraphics?: DebugGraphic[],
        damageCache?: DamageCacheManager,
        onMaterialPixel?: (samplePos: Vec2, sample: CollisionSample) => void
    ): GridRayTraceResult {
        this.logger.info("Stepping projectile through tile");

        if (!this.anythingCollidable) {
            this.logger.info("  - Contains nothing collidable");
            return;
        }

        const collisionLayers = this.getCollisionLayers(ImageManager.GetSingleton(), damageCache);
        if (collisionLayers.length === 0) {
            this.logger.info("  - Has no collision layers (but is collidable?");
            return;
        }

        for (const samplePos of walkCellBresenhamLine(
            subTileSrcPos,
            subTileDstPos,
            this._tileSize
        )) {
            this.logger.info(`  - ${samplePos} - sampling...`);

            const collisionSample = Tile.SampleCollisionLayers(samplePos, collisionLayers);

            if (!collisionSample) {
                // No material - so this is the exit point.
                this.logger.info(
                    `Projectile exited material ${currentMaterial.id} at ${samplePos}`
                );

                debugGraphics?.push(
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 8,
                        colour: Colour.White
                    },
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 6,
                        colour: new Colour({ ...currentMaterial.rgb!, a: 1 })
                    }
                );

                return {
                    pos: samplePos,
                    tile: this,
                    exitedMaterial: currentMaterial
                };
            }

            // Drain penetration energy for each pixel travelled inside material.
            const { material, owner, imageId, layerIndex, orientation } = collisionSample;

            if (material === currentMaterial) {
                onMaterialPixel?.(samplePos, collisionSample);
            }

            const pixelCost = calcPixelPenetrationCost({
                hardness: material.hardness,
                toughness: material.toughness,
                density: material.density
            });

            ray.life -= pixelCost;
            if (!ray.isRayAlive) {
                // Projectile ran out of penetration power.
                this.logger.info(`Projectile ran out of penetration power in ${material.id}`);

                debugGraphics?.push(
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 8,
                        colour: Colour.White
                    },
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 6,
                        colour: new Colour({ ...Colour.Red, a: 1 })
                    }
                );

                return {
                    pos: samplePos,
                    material,
                    tile: this,
                    owner,
                    imageId,
                    layerIndex,
                    orientation
                };
            }

            if (material !== currentMaterial) {
                // Material is not longer in the list, so choose the top-most material as the new one.
                this.logger.info(`Material changed to ${material.id}`);

                // Material changed - so generate a new collision point to process from.
                debugGraphics?.push(
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 8,
                        colour: Colour.White
                    },
                    {
                        type: DebugGraphicType.enum.point,
                        worldPos: this.aabb.topLeft.add(samplePos),
                        size: 6,
                        colour: new Colour({ ...currentMaterial.rgb!, a: 1 })
                    }
                );

                return {
                    pos: samplePos,
                    material,
                    tile: this,
                    owner,
                    imageId,
                    layerIndex,
                    orientation
                };
            }
        }
    }

    getVfxHpDamage(unitType = "default"): number {
        return this.vfx.reduce((damage, vfx) => damage + vfx.calcHpDamage(unitType), 0);
    }

    getVfxDisorientation(unitType = "default"): number {
        return this.vfx.reduce(
            (disorientation, vfx) => disorientation + vfx.calcDisorientation(unitType),
            0
        );
    }

    getMovementObstruction(type: string) {
        return this.furniture?.getMovementObstruction(type) ?? 0;
    }

    blocksMovement(type: string): boolean {
        const o = this.getMovementObstruction(type);
        return o === IMPENETRABLE || o > 10;
    }

    generateTileUpdate(): TileUpdate {
        return {
            tilePos: this.location,
            tileByRenderMode: {
                [RenderMode.enum.MAP_MODE]: this.getRenderList({
                    renderMode: RenderMode.enum.MAP_MODE,
                    states: []
                }),
                [RenderMode.enum.FIRE_MODE]: this.getRenderList({
                    renderMode: RenderMode.enum.FIRE_MODE,
                    states: []
                })
            }
        };
    }

    generateTimedTileUpdate(timeMs: number): TimedTileUpdate {
        return {
            timeMs,
            ...this.generateTileUpdate()
        };
    }

    static SampleCollisionLayers(
        samplePos: IVec2,
        collisionLayers: LayerCollision[]
    ): CollisionSample | undefined {
        for (const {
            image,
            orientation,
            owner,
            materials,
            imageId,
            layerIndex
        } of collisionLayers) {
            const materialColour = image.getColour(samplePos, orientation);
            if (materialColour.a > 0.0) {
                const [material] = Material.DetermineMaterial(materialColour, materials);
                return { material, owner, imageId, layerIndex, orientation };
            }
        }
    }

    private _updateTilePoi(): void {
        if (this.interestMasks.length > 0) {
            this._visibilityManager.addPoi(this);
        } else {
            this._visibilityManager.removePoi(this);
        }
    }

    getAvailableActions(
        relativeOrientation: Orientation,
        itemInUse: Item | null
    ): UnitActionType[] {
        return this.furniture?.getAvailableActions(relativeOrientation, itemInUse) ?? [];
    }

    toRecipe(): TileRecipe {
        const recipe: TileRecipe = {
            terrain: {
                id: this._terrain.id,
                orientation: Orientation.NORTH
            }
        };

        if (this._furniture) {
            recipe.furniture = {
                id: this._furniture.recipeId,
                orientation: this._furniture.orientation,
                state: this._furniture.state
            };
        }

        if (this._items.length > 0) {
            recipe.items = this._items.map((item) => ({
                id: item.recipeId,
                overrides: {
                    quantity: item.quantity
                }
            }));
        }

        return recipe;
    }

    getActionDefinition(
        action: UnitActionType,
        relativeOrientation: Orientation,
        itemInUse: Item | null
    ): WorldActionInstance | undefined {
        const actionDefinitions = this.furniture?.getAvailableActionDefinitions(
            relativeOrientation,
            itemInUse
        );
        if (!actionDefinitions) {
            return;
        }

        return actionDefinitions.find((actionDefinition) => actionDefinition.action === action);
    }
}
