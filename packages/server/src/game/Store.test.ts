import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { ErrorType, StoreSnapshot } from "@atbs/shared-data";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { Store, StoreRecipe } from "./Store.js";
import { Inventory } from "./Inventory.js";

const itemsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/items");

const STORE_RECIPE = StoreRecipe.parse({
    budget: 2000,
    threshold: -1000,
    categories: [{ name: "All", categories: null }],
    items: [
        {
            itemId: "m4+m203.gun",
            quantity: 5,
            baseCost: 1200,
            batchSize: 1,
            categories: ["Guns"]
        },
        {
            itemId: "m16-30.magazine",
            quantity: 10,
            baseCost: 20,
            batchSize: 1,
            categories: ["Magazines"]
        },
        {
            itemId: "5.56mm-nato.round",
            quantity: 1000,
            baseCost: 5,
            batchSize: 30,
            categories: ["Rounds"]
        },
        {
            itemId: "40mm-gas.round",
            quantity: 10,
            baseCost: 50,
            batchSize: 1,
            categories: ["Rounds"]
        },
        {
            itemId: "40mm-he.round",
            quantity: 10,
            baseCost: 50,
            batchSize: 1,
            categories: ["Rounds"]
        },
        {
            itemId: "40mm-smoke.round",
            quantity: 10,
            baseCost: 50,
            batchSize: 1,
            categories: ["Rounds"]
        },
        {
            itemId: "40mm-stun.round",
            quantity: 10,
            baseCost: 50,
            batchSize: 1,
            categories: ["Rounds"]
        }
    ]
});

describe("Store", () => {
    let itemManager: ItemManager;

    beforeAll(async () => {
        const recipes = new ItemRecipeManager();
        await recipes.loadItemRecipes(itemsDir);
        itemManager = new ItemManager(recipes);
    });

    function createStore() {
        return new Store(STORE_RECIPE, itemManager);
    }

    it("charges loaded cost and refunds component baseCosts when selling the stripped gun", () => {
        const store = createStore();
        const startingBudget = store.budget;

        const gun = store.buyItem("m4+m203.gun", 1);
        expect(gun).not.toBe(ErrorType.enum.INSUFFICIENT_BUDGET);
        if (typeof gun === "string") {
            throw new Error("expected item");
        }

        const spent = startingBudget - store.budget;
        expect(spent).toBeGreaterThan(1200);

        const inventory = new Inventory({ inUse: null, items: [] }, itemManager);
        inventory.addItem(gun);

        const m4 = gun.getSlotContents("0");
        const mag = m4.findSlotContents("ammo");
        expect(mag).toBeDefined();
        const unloadedMag = m4.unload();
        expect(unloadedMag).toBeDefined();
        if (unloadedMag) {
            inventory.addItem(unloadedMag);
        }

        const m203 = gun.getSlotContents("1");
        const round = m203.unload();
        if (round) {
            inventory.addOrCollapseItem(round);
        }

        store.sellItem(gun, 1);
        inventory.removeItem(gun);

        if (unloadedMag) {
            const magRounds = unloadedMag.unload();
            store.sellItem(unloadedMag, 1);
            inventory.removeItem(unloadedMag);
            if (magRounds) {
                store.sellItem(magRounds, magRounds.quantity);
            }
        }
        if (round) {
            store.sellItem(round, round.quantity);
        }

        expect(store.budget).toBeCloseTo(startingBudget, 6);
    });

    it("does not change budget when ammo is unloaded and loaded back from inventory", () => {
        const store = createStore();
        const gun = store.buyItem("m4+m203.gun", 1);
        if (typeof gun === "string") {
            throw new Error("expected item");
        }
        const afterBuy = store.budget;

        const m4 = gun.getSlotContents("0");
        const mag = m4.unload();
        expect(mag).toBeTruthy();
        if (!mag) {
            return;
        }

        m4.load(mag);
        expect(store.budget).toBe(afterBuy);
    });

    it("produces a snapshot the client can parse, including sold out items", () => {
        const store = createStore();

        expect(() => StoreSnapshot.parse(store.toSnapshot())).not.toThrow();

        const richStore = new Store(
            StoreRecipe.parse({ ...STORE_RECIPE, budget: 100000 }),
            itemManager
        );
        for (let bought = 0; bought < 5; bought++) {
            expect(richStore.buyItem("m4+m203.gun", 1)).not.toBe(
                ErrorType.enum.INSUFFICIENT_BUDGET
            );
        }

        const snapshot = StoreSnapshot.parse(richStore.toSnapshot());
        const gun = snapshot.items.find((entry) => entry.itemId === "m4+m203.gun");
        expect(gun?.item.quantity).toBe(0);
    });

    it("defaults the currency to $ and lets the scenario override it", () => {
        expect(createStore().toSnapshot().currency).toBe("$");

        const roubleStore = new Store(
            StoreRecipe.parse({ ...STORE_RECIPE, currency: "₽" }),
            itemManager
        );
        expect(roubleStore.toSnapshot().currency).toBe("₽");
    });

    it("rejects purchases below the threshold", () => {
        const store = new Store(
            StoreRecipe.parse({
                ...STORE_RECIPE,
                budget: 10,
                threshold: 0
            }),
            itemManager
        );

        expect(store.buyItem("m4+m203.gun", 1)).toBe(ErrorType.enum.INSUFFICIENT_BUDGET);
    });
});
