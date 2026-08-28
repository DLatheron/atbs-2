import { ITilePos, IVec2, randomOrientation, TilePos } from "@atbs/maths";
import {
    AnimationRecipe,
    AnimatableObjectRecipe,
    DamageMap,
    DamageType,
    PlayAnimation,
    RenderList,
    SceneContext,
    SceneObject,
    VfxId,
    VisibilityFilter
} from "@atbs/shared-data";
import cloneDeep from "lodash/cloneDeep.js";
import { VfxRecipe } from "./VfxRecipe.js";
import { VfxManager } from "./VfxManager.js";
import { AnimationRecipeManager } from "./AnimationRecipeManager.js";
import { Material } from "./Material.js";

export const TILE_LOCAL_CENTER = 50;
export const TILE_LOCAL_SIZE = 100;

export interface VfxAdditionalData {
    instanceIndex: number;
    location: ITilePos;
    fromLocation: ITilePos;
    lifetimeTurns: number;
    damageMap?: DamageMap;
    disorientationPerFullTurn?: number;
    materials: Material[];
}

export function appearTranslation(
    fromLocation: ITilePos,
    location: ITilePos
): { from: IVec2; to: IVec2 } {
    const to = { x: TILE_LOCAL_CENTER, y: TILE_LOCAL_CENTER };
    if (fromLocation.col === location.col && fromLocation.row === location.row) {
        return { from: to, to };
    }

    return {
        from: {
            x: TILE_LOCAL_CENTER + (fromLocation.col - location.col) * TILE_LOCAL_CENTER,
            y: TILE_LOCAL_CENTER + (fromLocation.row - location.row) * TILE_LOCAL_CENTER
        },
        to
    };
}

function damageMapAmount(damageMap: DamageMap | undefined, unitType: string): number {
    if (!damageMap) {
        return 0;
    }

    if (unitType === "human" && damageMap.human !== undefined) {
        return damageMap.human;
    }

    return damageMap.default;
}

export class Vfx extends SceneObject {
    private readonly _vfxManager: VfxManager;
    private readonly _id: VfxId;
    private readonly _recipe: Readonly<VfxRecipe>;
    private _location: TilePos;
    private readonly _fromLocation: TilePos;
    private _lifetimeTurns: number;
    private readonly _damageMap?: DamageMap;
    private readonly _disorientationPerFullTurn: number;
    private readonly _materials: Material[];
    private readonly _rotation: number;

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
        this._fromLocation = new TilePos(additionalData.fromLocation);
        this._lifetimeTurns = additionalData.lifetimeTurns;
        this._damageMap = additionalData.damageMap;
        this._disorientationPerFullTurn = additionalData.disorientationPerFullTurn ?? 0;
        this._materials = additionalData.materials;
        this._rotation = randomOrientation(8) * 45;
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

    get fromLocation(): TilePos {
        return this._fromLocation;
    }

    get lifetimeTurns(): number {
        return this._lifetimeTurns;
    }

    get materials(): Material[] {
        return this._materials;
    }

    get collisionImageId(): string | undefined {
        return this._recipe.collisionImageId;
    }

    get vfxManager(): VfxManager {
        return this._vfxManager;
    }

    decay(): boolean {
        if (this._lifetimeTurns > 0) {
            this._lifetimeTurns--;
        }
        return this._lifetimeTurns > 0;
    }

    calcHpDamage(unitType = "default"): number {
        if (!this._damageMap || this._damageMap.type === DamageType.enum.disorientation) {
            return 0;
        }
        return damageMapAmount(this._damageMap, unitType);
    }

    calcDisorientation(unitType = "default"): number {
        const fromMap =
            this._damageMap?.type === DamageType.enum.disorientation
                ? damageMapAmount(this._damageMap, unitType)
                : 0;
        return fromMap + this._disorientationPerFullTurn;
    }

    getRenderList(context: SceneContext): RenderList {
        return super.getRenderList({
            ...context,
            visibilityFilter: [VisibilityFilter.enum.visible]
        });
    }

    buildAnimatableObjectRecipe(): AnimatableObjectRecipe {
        const animationRecipes = this._recipe.animationRecipeIds.map((animationRecipeId, index) => {
            const recipe = cloneDeep(
                AnimationRecipeManager.GetSingleton().getRecipe(animationRecipeId)
            );

            recipe.id = `${recipe.id}-${this._id}`;
            recipe.stateDef = {
                ...recipe.stateDef,
                rotation: this._rotation
            };

            if (index === 0) {
                const { from, to } = appearTranslation(this._fromLocation, this._location);
                recipe.stateDef.translation = [
                    from,
                    [{ type: "linear", startOffset: 0, duration: 1000, toValue: to }]
                ];
            }

            return recipe;
        });

        return {
            instanceId: this._id,
            recipes: animationRecipes
        };
    }

    buildDisappearPlayAnimation(worldPos: IVec2): PlayAnimation | undefined {
        if (!this._recipe.disappearAnimationId) {
            return undefined;
        }

        const recipe: AnimationRecipe = cloneDeep(
            AnimationRecipeManager.GetSingleton().getRecipe(this._recipe.disappearAnimationId)
        );
        recipe.id = `${recipe.id}-${this._id}`;
        recipe.stateDef = {
            ...recipe.stateDef,
            rotation: this._rotation
        };

        return {
            instanceId: `${this._id}-disappear`,
            offset: 0,
            recipe,
            worldPos
        };
    }
}
