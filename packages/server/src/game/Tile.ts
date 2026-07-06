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
import z from "zod";
import { Terrain } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { IRenderableEntity } from "./IRenderableEntity.js";
import { SceneContext } from "./SceneObject.js";
import { FurnitureState, RenderList, RenderMode, TileInfo } from "@atbs/shared-data";
import { Unit } from "./Unit.js";
import { Furniture } from "./Furniture.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { Material } from "./Material.js";
import { Image } from "./Image.js";
import { ImageManager } from "./ImageManager.js";
import { GridRayTraceResult, walkCellBresenhamLine } from "./GridRayTrace.js";
import { IRayCast } from "./IRayCast.js";
import { Logger } from "@atbs/misc";
import { config } from "../config/config.schema.js";

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
        .optional()
    // items: z
    //     .array(
    //         z.object({
    //             id: z.string(),
    //             overrides: ItemRecipe.partial().optional()
    //         })
    //     )
    //     .optional(),
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
    owner: Furniture | Unit;
    image: Image;
    orientation: Orientation;
    materials: Material[];
}

export class Tile implements IRenderableEntity {
    readonly logger: Logger;

    protected _location: TilePos;
    protected _aabb: Aabb;
    protected _tileSize: number;
    protected readonly _terrain: Terrain;
    protected readonly _furniture?: Furniture;
    protected _units: Unit[];

    constructor(
        location: TilePos,
        tileSize: number,
        recipe: Readonly<TileRecipe>,
        furnitureManager: FurnitureManager
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
        this._units = [];
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

    get topmostUnit(): Unit | null {
        return this._units[0] ?? null;
    }

    get location(): TilePos {
        return this._location;
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
    }

    removeUnit(unit: Unit): void {
        if (!unit.location) {
            throw new Error(`Unit ${unit.id} does not have an assigned location`);
        }

        this._units = this._units.filter(({ id }) => id !== unit.id);
    }

    getRenderList(context: SceneContext): RenderList {
        if (this.units.length > 0) {
            this.logger.dir(this.units.map((unit) => unit.getRenderList(context)).flat(), {
                depth: null,
                colors: true
            });
        }

        return [
            ...this.terrain.getRenderList(context),
            ...(this.furniture?.getRenderList(context) ?? []),
            ...this.units.map((unit) => unit.getRenderList(context)).flat()
        ];
    }

    getTileInfo(): TileInfo {
        const { terrain, topmostUnit } = this;

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
            ...(topmostUnit && {
                unit: {
                    name: topmostUnit.name,
                    uiImage: topmostUnit.getRenderList({
                        renderMode: RenderMode.enum.UI_MODE,
                        states: []
                    }),
                    description: topmostUnit.description
                }
            })
        };
    }

    get anythingCollidable() {
        return this.furniture || this.units.length > 0; // || this.vfx.length > 0;
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

    getCollisionLayers(imageManager: ImageManager): LayerCollision[] {
        const collisionLayers: LayerCollision[] = [];

        const context: SceneContext = {
            renderMode: RenderMode.enum.FIRE_MODE,
            states: []
        };

        if (this.furniture) {
            const { materials } = this.furniture;

            this.furniture.getRenderList(context).forEach((layerImage) => {
                if (layerImage.imageId) {
                    collisionLayers.push({
                        owner: this.furniture!,
                        image: imageManager.getImage(layerImage.imageId),
                        orientation: layerImage.orientation ?? Orientation.NORTH,
                        materials
                    });
                }
            });
        }

        this.units.forEach((unit) => {
            // const { materials } = unit; // TODO: Unit materials?

            unit.getRenderList(context).forEach((layerImage) => {
                if (layerImage.imageId) {
                    collisionLayers.push({
                        owner: unit,
                        image: imageManager.getImage(layerImage.imageId),
                        orientation: layerImage.orientation ?? Orientation.NORTH,
                        materials: []
                    });
                }
            });
        });

        // this.vfx.forEach((vfx) => {
        //     const { materials } = vfx;

        //     vfx.getRenderList(context).forEach((layerImage) => {
        //         if (layerImage.imageId) {
        //             layerCollision.push({
        //                 image: imageManager.getImage(layerImage.imageId),
        //                 orientation: layerImage.orientation ?? Orientation.NORTH,
        //                 materials
        //             });
        //         }
        //     });
        // });

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
        debugGraphics?: DebugGraphic[]
    ): GridRayTraceResult {
        this.logger.info("Casting against tile");

        if (!this.anythingCollidable) {
            this.logger.info("  - Contains nothing collidable");
            return;
        }

        const collisionLayers = this.getCollisionLayers(ImageManager.GetSingleton());
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
                const { material, owner } = collisionSample;
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

                return { pos: samplePos, material, tile: this, owner };
            }
        }
    }

    stepRay(
        ray: IRayCast,
        subTileSrcPos: Vec2,
        subTileDstPos: Vec2,
        currentMaterial: Material,
        debugGraphics?: DebugGraphic[]
    ): GridRayTraceResult {
        this.logger.info("Stepping projectile through tile");

        if (!this.anythingCollidable) {
            this.logger.info("  - Contains nothing collidable");
            return;
        }

        const collisionLayers = this.getCollisionLayers(ImageManager.GetSingleton());
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
            const { material, owner } = collisionSample;
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
                    owner
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
                    owner
                };
            }
        }
    }

    static SampleCollisionLayers(
        samplePos: IVec2,
        collisionLayers: LayerCollision[]
    ): { material: Material; owner: Furniture | Unit } | undefined {
        for (const { image, orientation, owner, materials } of collisionLayers) {
            const materialColour = image.getColour(samplePos, orientation);
            if (materialColour.a > 0.0) {
                const [material] = Material.DetermineMaterial(materialColour, materials);
                return { material, owner };
            }
        }
    }
}
