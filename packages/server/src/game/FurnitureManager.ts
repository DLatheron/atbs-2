import { FurnitureId, InstanceId, ItemId } from "@atbs/shared-data";
import { Furniture, FurnitureOverrides } from "./Furniture.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";

export class FurnitureManager {
    private readonly _furnitureRecipeManager: FurnitureRecipeManager;
    private readonly _furnitureMap: Map<InstanceId, Furniture>;
    private readonly _instanceMap: Map<ItemId, number>;

    constructor(furnitureRecipeManager: FurnitureRecipeManager) {
        this._furnitureRecipeManager = furnitureRecipeManager;
        this._furnitureMap = new Map<InstanceId, Furniture>();
        this._instanceMap = new Map<ItemId, number>();
    }

    private _getInstanceIndex(furnitureId: FurnitureId) {
        const instanceIndex = this._instanceMap.get(furnitureId) ?? 1;
        this._instanceMap.set(furnitureId, instanceIndex + 1);
        return instanceIndex;
    }

    newFurniture(furnitureId: FurnitureId, overrides: FurnitureOverrides): Furniture {
        const recipe = this._furnitureRecipeManager.getRecipe(furnitureId);
        const instanceIndex = this._getInstanceIndex(furnitureId);

        const furniture = new Furniture(recipe, overrides, { instanceIndex }, this);

        this._furnitureMap.set(furniture.id, furniture);

        return furniture;
    }

    deleteFurniture(instanceId: InstanceId): boolean {
        return this._furnitureMap.delete(instanceId);
    }

    findFurniture(instanceId: InstanceId): Furniture | undefined {
        return this._furnitureMap.get(instanceId);
    }

    getFurniture(instanceId: InstanceId): Furniture | never {
        const item = this.findFurniture(instanceId);
        if (!item) {
            throw new Error(`Furniture ${instanceId} not found`);
        }
        return item;
    }

    hasFurniture(instanceId: InstanceId): boolean {
        return !!this.findFurniture(instanceId);
    }
}
