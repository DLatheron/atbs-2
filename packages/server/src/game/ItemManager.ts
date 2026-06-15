import { InstanceId, ItemId } from "@atbs/shared-data";
import { Item } from "./Item.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { ItemOverrides } from "./ItemRecipe.js";

export class ItemManager {
    private readonly _itemRecipeManager: ItemRecipeManager;
    private readonly _itemMap: Map<InstanceId, Item>;
    private readonly _instanceMap: Map<ItemId, number>;

    constructor(itemRecipeManager: ItemRecipeManager) {
        this._itemRecipeManager = itemRecipeManager;
        this._itemMap = new Map<InstanceId, Item>();
        this._instanceMap = new Map<ItemId, number>();
    }

    private _getInstanceIndex(itemId: ItemId) {
        const instanceIndex = this._instanceMap.get(itemId) ?? 1;
        this._instanceMap.set(itemId, instanceIndex + 1);
        return instanceIndex;
    }

    createItem(itemId: ItemId, overrides?: ItemOverrides): Item {
        const recipe = this._itemRecipeManager.getRecipe(itemId);
        const instanceIndex = this._getInstanceIndex(itemId);

        const item = new Item(recipe, overrides ?? {}, { instanceIndex }, this);

        this._itemMap.set(item.id, item);

        return item;
    }

    deleteItem(instanceId: InstanceId): boolean {
        return this._itemMap.delete(instanceId);
    }

    findItem(instanceId: InstanceId): Item | undefined {
        return this._itemMap.get(instanceId);
    }

    getItem(instanceId: InstanceId): Item | never {
        const item = this.findItem(instanceId);
        if (!item) {
            throw new Error(`Item ${instanceId} not found`);
        }
        return item;
    }

    hasItem(instanceId: InstanceId): boolean {
        return !!this.findItem(instanceId);
    }
}
