import { Orientation, TilePos } from "@atbs/maths";
import z from "zod";
import { Terrain } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { IRenderableEntity } from "./IRenderableEntity.js";
import { SceneContext } from "./SceneObject.js";
import { FurnitureState, RenderList, RenderMode, TileInfo } from "@atbs/shared-data";
import { Unit } from "./Unit.js";
import { Furniture } from "./Furniture.js";
import { FurnitureManager } from "./FurnitureManager.js";

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

export class Tile implements IRenderableEntity {
    protected _location: TilePos;
    protected readonly _terrain: Terrain;
    protected readonly _furniture?: Furniture;
    protected _units: Unit[];

    constructor(
        location: TilePos,
        recipe: Readonly<TileRecipe>,
        furnitureManager: FurnitureManager
    ) {
        this._location = location;
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
            tilePos: [this._location.col, this._location.row],
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
}
