import {
    AttributeDef,
    Description,
    FurnitureId,
    FurnitureState,
    FurnitureStateMovementObstructionMap,
    InstanceId,
    RenderList,
    RenderMode
} from "@atbs/shared-data";
import z from "zod";
import { SceneContext, SceneNode, SceneObject } from "./SceneObject.js";
import { Orientation, TilePos } from "@atbs/maths";
import { FurnitureManager } from "./FurnitureManager.js";
import { Material } from "./Material.js";
import { MaterialManager } from "./MaterialManager.js";
import { DamageCacheManager } from "./DamageCacheManager.js";

export const FurnitureRecipe = z.object({
    id: FurnitureId,
    name: z.string().nonempty(),
    description: Description,
    renderable: SceneNode,
    hitPoints: AttributeDef.optional(),
    movementObstruction: FurnitureStateMovementObstructionMap,
    materials: z.array(z.string()),
    pixelDestruction: z.boolean().optional().default(false)
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
    private readonly _furnitureManager: FurnitureManager;

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
        furnitureManager: FurnitureManager
    ) {
        super(recipe.renderable);

        this._id = `${recipe.id}-${additionalData.instanceIndex}`;
        this._recipe = recipe;

        this._furnitureManager = furnitureManager;

        this._location = new TilePos(overrides.location);
        this._orientation = overrides.orientation ?? Orientation.NORTH;
        this._materials = recipe.materials.map((materialId) =>
            this.materialManager.getMaterial(materialId)
        );
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

    get pixelDestruction(): boolean {
        return this._recipe.pixelDestruction;
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

    private get furnitureManager(): FurnitureManager {
        return this._furnitureManager;
    }

    private get materialManager(): MaterialManager {
        return this.furnitureManager.materialManager;
    }

    takeDamage(amount: number): boolean {
        if (this.state === FurnitureState.enum.destroyed) {
            return false;
        }

        const previousHitPoints = this.hitPoints;
        this.hitPoints = Math.max(0, previousHitPoints - amount);

        return previousHitPoints > 0 && this.hitPoints === 0;
    }

    getPairedImageIds(): { visualId: string; collisionId: string; layerIndex: number }[] {
        const mapContext: SceneContext = {
            renderMode: RenderMode.enum.MAP_MODE,
            states: [this.state],
            orientation: this.orientation
        };
        const fireContext: SceneContext = {
            renderMode: RenderMode.enum.FIRE_MODE,
            states: [this.state],
            orientation: this.orientation
        };

        const visualList = super.getRenderList(mapContext);
        const collisionList = super.getRenderList(fireContext);

        return visualList.flatMap((visual, layerIndex) => {
            if (!visual.imageId) {
                return [];
            }

            const collisionId = collisionList[layerIndex]?.imageId ?? visual.imageId;

            return [{ visualId: visual.imageId, collisionId, layerIndex }];
        });
    }

    applyDamageImageOverrides(renderList: RenderList, damageCache: DamageCacheManager): RenderList {
        return renderList.map((renderImage) => {
            if (!renderImage.imageId) {
                return renderImage;
            }

            return {
                ...renderImage,
                imageId: damageCache.getImageIdOverride(renderImage.imageId, this.location)
            };
        });
    }

    getRenderList(context: SceneContext, damageCache?: DamageCacheManager): RenderList {
        const unitContext = {
            ...context,
            states: [this.state],
            orientation: this.orientation
        };

        const renderList = super.getRenderList(unitContext);

        if (damageCache) {
            return this.applyDamageImageOverrides(renderList, damageCache);
        }

        return renderList;
    }
}
