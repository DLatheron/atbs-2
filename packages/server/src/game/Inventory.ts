import z from "zod";
import { ItemId } from "@atbs/shared-data";
import { Item } from "./Item.js";
import { ItemManager } from "./ItemManager.js";
import { ItemOverrides } from "./ItemRecipe.js";

export const InventoryRecipe = z.object({
    inUse: z.number().nonnegative().nullable(),
    items: z.array(z.object({ id: ItemId, overrides: ItemOverrides.optional() }))
});
export type InventoryRecipe = z.infer<typeof InventoryRecipe>;

export class Inventory {
    protected _inUse: number;
    protected _weaponIndex: number;
    protected _items: Item[];
    protected readonly _itemsMap: Map<ItemId, Item>;
    protected readonly _itemManager: ItemManager;

    constructor(recipe: InventoryRecipe, itemManager: ItemManager) {
        this._inUse = recipe.inUse !== null ? recipe.inUse : -1;
        this._weaponIndex = 0;

        this._items = [];
        this._itemsMap = new Map<ItemId, Item>();
        this._itemManager = itemManager;

        recipe.items.forEach(({ id, overrides }) => {
            const item = itemManager.newItem(id, overrides);
            this.addItem(item, this._items.length);
        });
    }

    get items(): Item[] {
        return this._items;
    }

    get itemInUse(): Item | null {
        return this._inUse >= 0 ? this._items[this._inUse] : null;
    }

    get weaponIndex(): number {
        return this._weaponIndex;
    }

    set weaponIndex(value: number) {
        this._weaponIndex = value;
    }

    selectItem(item: Item) {
        const atIndex = this._items.findIndex(({ id }) => item.id === id);
        if (atIndex === -1) {
            throw new Error(`Item ${item.id} is not in the inventory`);
        }
        this._inUse = atIndex;
        this._weaponIndex = 0;
    }

    deselectItem(): void {
        this._inUse = -1;
        this._weaponIndex = 0;
    }

    addItem(item: Item, atIndex = this._items.length): Item {
        if (this.findItem(item.id)) {
            throw new Error(`Item ${item.id} has already been added to the inventory`);
        }

        const previousInUseItemId = this.itemInUse?.id;

        this._items.splice(atIndex, 0, item);
        this._itemsMap.set(item.id, item);

        if (previousInUseItemId !== undefined) {
            this._inUse = this._items.findIndex(({ id }) => previousInUseItemId === id);
        }

        return item;
    }

    addOrCollapseItem(item: Item, atIndex = this._items.length): Item {
        if (!item.canCollapse) {
            return this.addItem(item, atIndex);
        }

        const itemOfSameRecipe = this._items.find(({ recipeId }) => recipeId === item.recipeId);
        if (!itemOfSameRecipe) {
            return this.addItem(item, atIndex);
        }

        itemOfSameRecipe.quantity += item.quantity;
        item.quantity = 0; // For debug purposes.

        return itemOfSameRecipe;
    }

    removeItem(item: Item): Item {
        const atIndex = this._items.findIndex(({ id }) => item.id === id);
        if (atIndex === -1) {
            throw new Error(`Item ${item.id} is not in the inventory`);
        }

        const previousInUseItemId = this.itemInUse?.id;

        this._items.splice(atIndex, 1);
        this._itemsMap.delete(item.id);

        if (previousInUseItemId !== undefined) {
            this._inUse = this._items.findIndex(({ id }) => previousInUseItemId === id);
        }

        return item;
    }

    findItem(itemId: ItemId): Item | undefined {
        return this._itemsMap.get(itemId);
    }

    getItem(itemId: ItemId): Item {
        const item = this.findItem(itemId);
        if (!item) {
            throw new Error(`Item ${itemId} is not in the inventory`);
        }
        return item;
    }

    dropAllItem(): Item[] {
        const droppedItems = this._items;
        this._items = [];
        this._itemsMap.clear();
        this._inUse = -1;
        this._weaponIndex = 0;
        return droppedItems;
    }

    reorderItem(fromIndex: number, toIndex: number) {
        if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= this._items.length ||
            toIndex >= this._items.length
        ) {
            throw new Error(`Cannot reorder inventory from index ${fromIndex} to ${toIndex}`);
        }

        const previousInUseItemId = this.itemInUse?.id;

        const [item] = this._items.splice(fromIndex, 1);
        this._items.splice(toIndex, 0, item);

        if (previousInUseItemId !== undefined) {
            this._inUse = this._items.findIndex(({ id }) => previousInUseItemId === id);
        }
    }
}
