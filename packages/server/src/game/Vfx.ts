import { ITilePos, TilePos } from "@atbs/maths";
import { VfxId } from "@atbs/shared-data";
import { SceneObject } from "./SceneObject.js";
import { VfxRecipe } from "./VfxRecipe.js";
import { VfxManager } from "./VfxManager.js";
import { AnimationRecipeManager } from "./AnimationRecipeManager.js";

export interface VfxAdditionalData {
    instanceIndex: number;
    location: ITilePos;
}

export class Vfx extends SceneObject {
    private readonly _vfxManager: VfxManager;
    private readonly _id: VfxId;
    private readonly _recipe: Readonly<VfxRecipe>;
    private _location: TilePos;

    constructor(
        vfxManager: VfxManager,
        recipe: Readonly<VfxRecipe>,
        additionalData: Readonly<VfxAdditionalData>
    ) {
        const instanceId = `anim-${recipe.id}-${additionalData.instanceIndex}`;

        super(recipe.renderable ?? { default: [{ imageId: instanceId }] });

        this._vfxManager = vfxManager;
        this._id = instanceId;
        this._recipe = recipe;
        this._location = new TilePos(additionalData.location);

        const animationRecipe = AnimationRecipeManager.GetSingleton().getRecipe(
            this.recipe.animationRecipeId
        );

        // Register this animation with all clients.
        this._vfxManager.game.broadcastMessage({
            type: "server:animations:play",
            payload: [{ instanceId, recipe: animationRecipe }]
        });
    }

    get id(): VfxId {
        return this._id;
    }

    get recipeId(): VfxId {
        return this._recipe.id;
    }

    get recipe(): VfxRecipe {
        return this._recipe;
    }

    get location(): TilePos {
        return this._location;
    }

    set location(location: TilePos) {
        this._location = location;
    }
}
