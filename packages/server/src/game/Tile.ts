import {
    Aabb,
    DebugGraphic,
    DebugGraphicType,
    type DebugTile,
    type IColour,
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
import { Projectile } from "./Projectile.js";
import { Material } from "./Material.js";
import { stepGrid } from "./GridHelpers.js";
import { Image } from "./Image.js";
import { ImageManager } from "./ImageManager.js";

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
    owner?: Furniture | Unit;
    image: Image;
    orientation: Orientation;
    materials: Material[];
}

export class Tile implements IRenderableEntity {
    protected _location: TilePos;
    protected _aabb: Aabb;
    protected readonly _terrain: Terrain;
    protected readonly _furniture?: Furniture;
    protected _units: Unit[];

    constructor(
        location: TilePos,
        tileSize: number,
        recipe: Readonly<TileRecipe>,
        furnitureManager: FurnitureManager
    ) {
        this._location = location;
        this._aabb = new Aabb(location.col * tileSize, location.row * tileSize, tileSize, tileSize);
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
            console.dir(this.units.map((unit) => unit.getRenderList(context)).flat(), {
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
        const layerCollision: LayerCollision[] = [];

        const context: SceneContext = {
            renderMode: RenderMode.enum.FIRE_MODE,
            states: []
        };

        if (this.furniture) {
            const { materials } = this.furniture;

            this.furniture.getRenderList(context).forEach((layerImage) => {
                if (layerImage.imageId) {
                    layerCollision.push({
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
                    layerCollision.push({
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

        return layerCollision;
    }

    stepTile(
        projectile: Projectile,
        debugGraphics?: DebugGraphic[]
    ): Vec2 | false | "out-of-bounds" {
        if (!this.anythingCollidable) {
            return false;
        }

        const collisionLayers = this.getCollisionLayers(ImageManager.GetSingleton());
        if (collisionLayers.length === 0) {
            return false;
        }

        // TODO: Get the collision layers we need to consider AND their orientation...

        // debugGraphics?.push(
        //     {
        //         type: DebugGraphicType.enum.line,
        //         srcWorldPos: projectile.srcPos,
        //         dstWorldPos: projectile.dstPos,
        //         strokeColour: Colour.White,
        //         strokeThickness: 2
        //     },
        //     {
        //         type: DebugGraphicType.enum.point,
        //         worldPos: projectile.srcPos,
        //         size: 6,
        //         colour: Colour.Red
        //     },
        //     {
        //         type: DebugGraphicType.enum.point,
        //         worldPos: projectile.dstPos,
        //         size: 6,
        //         colour: Colour.Blue
        //     }
        // );

        const grid = { aabb: this.aabb, gridScale: 1, subGrid: false };

        const result = stepGrid(
            projectile,
            grid,
            (samplePos) => {
                let hitMaterial: Material | undefined;

                for (const { image, orientation, materials } of collisionLayers) {
                    const materialColour = image.getColour(samplePos, orientation);
                    if (materialColour.a > 0.0) {
                        // NOTE: We only consider the first material that we strike!
                        const [material] = Material.DetermineMaterial(materialColour, materials);
                        hitMaterial = material;
                        break;
                    }
                }
                return hitMaterial;
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (_collisionPos: Vec2, _material: Material) => {
                // TODO: Do something with the material.
                return false;
            },
            debugGraphics
        );

        return result;
    }
}
