import {
    AttributeDef,
    Description,
    FurnitureId,
    FurnitureState,
    FurnitureStateMap,
    InstanceId
} from "@atbs/shared-data";
import z from "zod";
import { SceneNode, SceneObject } from "./SceneObject.js";
import { Orientation, TilePos } from "@atbs/maths";
import { FurnitureManager } from "./FurnitureManager.js";

export const FurnitureRecipe = z.object({
    id: FurnitureId,
    name: z.string().nonempty(),
    description: Description,
    renderable: SceneNode,
    hitPoints: AttributeDef.optional(),
    movementObstruction: FurnitureStateMap,
    materials: z.array(z.unknown()),
    action: z.record(z.string().nonempty(), z.unknown()).optional()
});
export type FurnitureRecipe = z.infer<typeof FurnitureRecipe>;

export interface FurnitureOverrides {
    location: TilePos;
    orientation?: Orientation;
    state?: FurnitureState;
}

export interface FurnitureAdditionalData {
    instanceIndex: number;
}

export class Furniture extends SceneObject {
    private readonly _recipe: Readonly<FurnitureRecipe>;
    // private readonly _furnitureManager: FurnitureManager;

    private readonly _id: InstanceId;
    private readonly _location: TilePos;
    private readonly _orientation: Orientation;
    private readonly _state: FurnitureState;

    constructor(
        recipe: Readonly<FurnitureRecipe>,
        overrides: Readonly<FurnitureOverrides>,
        additionalData: Readonly<FurnitureAdditionalData>,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _furnitureManager: FurnitureManager
    ) {
        super(recipe.renderable);

        this._id = `${recipe.id}-${additionalData.instanceIndex}`;
        this._recipe = recipe;
        // this._furnitureManager = furnitureManager;
        this._location = new TilePos(overrides.location);
        this._orientation = overrides.orientation ?? Orientation.NORTH;
        this._state = overrides.state ?? FurnitureState.enum.default;
    }

    get id(): InstanceId {
        return this._id;
    }

    get recipeId(): FurnitureId {
        return this._recipe.id;
    }

    get location(): TilePos {
        return this._location;
    }

    get orientation(): Orientation {
        return this._orientation;
    }

    get state(): FurnitureState {
        return this._state;
    }
}
