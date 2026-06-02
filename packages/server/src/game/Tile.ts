import { Orientation, TilePos } from "@atbs/maths";
import z from "zod";
import { Terrain } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { IRenderableEntity } from "./IRenderableEntity.js";
import { SceneContext } from "./SceneObject.js";
import { RenderList } from "@atbs/shared-data";

export const TileRecipe = z.object({
    terrain: z.object({
        id: z.string(),
        orientation: z.enum(Orientation).optional()
    })
    // furniture: z
    //     .object({
    //         id: z.string(),
    //         orientation: z.nativeEnum(Orientation).optional(),
    //         state: z.string().optional()
    //     })
    //     .optional(),
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
    protected _terrain: Terrain;

    constructor(location: TilePos, recipe: TileRecipe) {
        this._location = location;
        this._terrain = TerrainManager.GetSingleton().get(recipe.terrain.id);
    }

    get terrain(): Terrain {
        return this.terrain;
    }

    get location(): TilePos | null {
        return this._location;
    }

    get isDirectional(): boolean {
        return false;
    }

    get orientation(): Orientation {
        return Orientation.NORTH;
    }

    getRenderList(context: SceneContext): RenderList {
        return [...this._terrain.getRenderList(context)];
    }
}
