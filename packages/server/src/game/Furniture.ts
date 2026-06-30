import {
    AttributeDef,
    Description,
    FurnitureId,
    FurnitureState,
    FurnitureStateMovementObstructionMap,
    InstanceId,
    RenderList
} from "@atbs/shared-data";
import z from "zod";
import { SceneContext, SceneNode, SceneObject } from "./SceneObject.js";
import { Orientation, TilePos } from "@atbs/maths";
import { FurnitureManager } from "./FurnitureManager.js";
import { Material, MaterialRecipe } from "./Material.js";

export const FurnitureRecipe = z.object({
    id: FurnitureId,
    name: z.string().nonempty(),
    description: Description,
    renderable: SceneNode,
    hitPoints: AttributeDef.optional(),
    movementObstruction: FurnitureStateMovementObstructionMap,
    materials: z.array(MaterialRecipe)
    // action: z.record(z.string().nonempty(), z.unknown()).optional()
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

export function isFurniture(arg: unknown): arg is Furniture {
    return arg instanceof Furniture;
}

export class Furniture extends SceneObject {
    private readonly _recipe: Readonly<FurnitureRecipe>;
    // private readonly _furnitureManager: FurnitureManager;

    private readonly _id: InstanceId;
    private readonly _location: TilePos;
    private readonly _orientation: Orientation;
    private readonly _materials: Material[];
    private _state: FurnitureState;
    private _hitPoints: number;

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
        this._materials = recipe.materials.map((materialRecipe) => new Material(materialRecipe));
        this._state = overrides.state ?? FurnitureState.enum.default;
        this._hitPoints = recipe.hitPoints?.value ?? recipe.hitPoints?.max ?? 0;
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

    get hitPoints(): number {
        return this._hitPoints;
    }

    set hitPoints(value: number) {
        if (this.hitPoints > 0 && value === 0) {
            this._state = FurnitureState.enum.destroyed;
        }
        this._hitPoints = value;
    }

    get state(): FurnitureState {
        return this._state;
    }

    get materials(): Material[] {
        return this._materials;
    }

    getRenderList(context: SceneContext): RenderList {
        const unitContext = {
            ...context,
            states: [this.state],
            orientation: this.orientation
        };

        return super.getRenderList(unitContext);
    }
}
