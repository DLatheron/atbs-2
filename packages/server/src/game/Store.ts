import {
    DEFAULT_CURRENCY,
    ErrorType,
    ItemId,
    ItemType,
    StoreSnapshot,
    type StoreCategory
} from "@atbs/shared-data";
import z from "zod";
import { Item } from "./Item.js";
import { ItemManager } from "./ItemManager.js";

export const StoreRecipe = z.object({
    budget: z.number().min(0),
    threshold: z.number().max(0),
    currency: z.string().default(DEFAULT_CURRENCY),
    categories: z.array(
        z.object({
            name: z.string(),
            categories: z.array(z.string()).nullable()
        })
    ),
    items: z.array(
        z.object({
            itemId: ItemId,
            quantity: z.int().positive().optional(),
            batchSize: z.number().min(1).default(1),
            baseCost: z.number().min(0),
            categories: z.array(z.string())
        })
    )
});
export type StoreRecipe = z.infer<typeof StoreRecipe>;

export interface StoreItem {
    item: Item;
    batchSize: number;
    baseCost: number;
    cost: number;
    categories: string[];
}

export class Store {
    private _budget: number;
    private readonly _threshold: number;
    private readonly _currency: string;
    private readonly _categories: StoreCategory[];
    private readonly _items: StoreItem[];

    constructor(recipe: StoreRecipe, itemManager: ItemManager) {
        this._budget = recipe.budget;
        this._threshold = recipe.threshold;
        this._currency = recipe.currency;
        this._categories = recipe.categories;
        this._items = recipe.items.map(({ itemId, quantity, batchSize, baseCost, categories }) => ({
            item: itemManager.newItem(itemId, quantity !== undefined ? { quantity } : undefined),
            batchSize,
            baseCost,
            cost: baseCost,
            categories
        }));

        this._calculateItemCosts();
        this._emptyAllItems();
        this._preloadAllItems();
    }

    get budget(): number {
        return this._budget;
    }

    get threshold(): number {
        return this._threshold;
    }

    get currency(): string {
        return this._currency;
    }

    get categories(): StoreCategory[] {
        return this._categories;
    }

    get items(): StoreItem[] {
        return this._items;
    }

    findItem(itemId: ItemId): StoreItem | undefined {
        return this._items.find(({ item }) => item.recipeId === itemId);
    }

    getItem(itemId: ItemId): StoreItem {
        const item = this.findItem(itemId);
        if (!item) {
            throw new Error(`Item ${itemId} not found in store`);
        }
        return item;
    }

    isStoreItem(recipeId: ItemId): boolean {
        return this.findItem(recipeId) !== undefined;
    }

    componentCost(recipeId: ItemId, quantity: number): number {
        const storeItem = this.getItem(recipeId);
        return storeItem.baseCost * (quantity / storeItem.batchSize);
    }

    buyItem(itemId: ItemId, quantity: number): Item | ErrorType {
        const storeItem = this.findItem(itemId);
        if (!storeItem) {
            throw new Error(`Store does not have item ${itemId}`);
        }

        const { item } = storeItem;
        if (quantity > item.quantity) {
            throw new Error(`Store does not have enough of item ${itemId}`);
        }

        const cost = (storeItem.cost * quantity) / storeItem.batchSize;
        if (this._budget - cost < this._threshold) {
            return ErrorType.enum.INSUFFICIENT_BUDGET;
        }

        this._budget -= cost;
        return item.takeQuantity(quantity);
    }

    sellItem(item: Item, quantity: number): Item | undefined {
        const storeItem = this.findItem(item.recipeId);
        if (!storeItem) {
            throw new Error(`Store does not have item ${item.recipeId}`);
        }

        const componentsToSell = item.removeStoreComponents(
            (recipeId) => this.isStoreItem(recipeId),
            true
        );

        const totalLevelQuantity = Math.min(quantity, item.quantity);

        const refundCost = componentsToSell.reduce((totalRefund, componentToSell, index) => {
            const actualQuantity = Math.min(
                componentToSell.quantity,
                index === 0 ? totalLevelQuantity : Number.MAX_SAFE_INTEGER
            );
            const itemCost = this.componentCost(componentToSell.recipeId, actualQuantity);
            this.getItem(componentToSell.recipeId).item.quantity += actualQuantity;
            return totalRefund + itemCost;
        }, 0);

        item.quantity -= totalLevelQuantity;
        this._budget += refundCost;

        return item.quantity === 0 ? item : undefined;
    }

    toSnapshot(): StoreSnapshot {
        return {
            budget: this._budget,
            threshold: this._threshold,
            currency: this._currency,
            categories: this._categories,
            items: this._items.map(({ item, batchSize, cost, categories }) => ({
                itemId: item.recipeId,
                item: item.toInventoryItemView(),
                batchSize,
                cost,
                categories
            }))
        };
    }

    private _calculateItemCosts() {
        for (const storeItem of this._items) {
            storeItem.cost = this._loadedCost(storeItem.item, true);
        }
    }

    private _loadedCost(item: Item, isRoot: boolean): number {
        let total = 0;
        const storeItem = this.findItem(item.recipeId);
        if (isRoot && storeItem) {
            total += storeItem.baseCost;
        } else if (storeItem) {
            total += this.componentCost(item.recipeId, item.quantity);
        }

        for (const [, contents] of item.slotEntries) {
            total += this._loadedCost(contents, false);
        }

        return total;
    }

    private _emptyAllItems() {
        for (const storeItem of this._items) {
            const extracted = storeItem.item.removeStoreComponents(
                (recipeId) => this.isStoreItem(recipeId),
                false
            );
            for (const component of extracted) {
                this.getItem(component.recipeId).item.quantity += component.quantity;
            }
        }
    }

    private _preloadAllItems() {
        for (const { item } of this._items) {
            this._preloadItem(item);
        }
    }

    private _preloadItem(item: Item) {
        for (const [, contents] of item.slotEntries) {
            this._preloadItem(contents);
        }

        if (!item.canLoad() || item.findSlotContents("ammo")) {
            return;
        }

        const { compatibleIds, maxQuantity } = item.getSlotProps("ammo");
        const magazineIds = compatibleIds.filter((id) => {
            const storeItem = this.findItem(id);
            return storeItem?.item.type === ItemType.enum.magazine;
        });
        const roundIds = compatibleIds.filter((id) => {
            const storeItem = this.findItem(id);
            return storeItem?.item.type === ItemType.enum.round;
        });

        if (magazineIds.length > 0) {
            const magazine = this._takeBest(magazineIds, 1);
            if (magazine) {
                this._preloadItem(magazine);
                item.setSlotContents("ammo", magazine);
            }
            return;
        }

        if (roundIds.length > 0) {
            const rounds = this._takeBest(roundIds, maxQuantity);
            if (rounds) {
                item.load(rounds);
            }
        }
    }

    private _takeBest(ammoIds: ItemId[], quantity: number): Item | undefined {
        let best: StoreItem | undefined;
        for (const ammoId of ammoIds) {
            const storeItem = this.findItem(ammoId);
            if (!storeItem || storeItem.item.quantity <= 0) {
                continue;
            }
            if (!best || storeItem.item.quantity > best.item.quantity) {
                best = storeItem;
            }
        }

        if (!best) {
            return undefined;
        }

        const take = Math.min(quantity, best.item.quantity);
        if (take <= 0) {
            return undefined;
        }

        return best.item.takeQuantity(take);
    }
}
