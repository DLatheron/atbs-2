import { beforeEach, describe, expect, it } from "vitest";
import { TilePos } from "@atbs/maths";
import type { Game } from "./Game.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { Inventory, InventoryRecipe } from "./Inventory.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipe, SlotType } from "./ItemRecipe.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { TileRecipe } from "./Tile.js";
import { VisibilityManager } from "./VisibilityManager.js";
import { MapRecipe, WorldMap } from "./WorldMap.js";

const PROJECTILE = {
    maxRange: 3000,
    perturbation: 100,
    visual: {
        headColour: { r: 255, g: 255, b: 255, a: 1 },
        headRadiusInPixels: 2,
        trailColour: { r: 255, g: 255, b: 255, a: 1 },
        trailLengthInPixels: 100,
        rangeFalloffPower: 20
    },
    damage: { human: 18, default: 20 },
    mass: 0.004,
    velocity: 993,
    diameter: 5.56,
    hardness: 1,
    shape: 1,
    stability: 1,
    bounce: 0.75,
    integrity: 1
};

const SINGLE_FIRE_MODES = {
    single: {
        ammoUse: 1,
        fireModeDetails: {
            aimed: { accuracy: 80, actionPoints: 25 },
            snapshot: { accuracy: 50, actionPoints: 13 }
        }
    }
};

const ROUND_RECIPE = ItemRecipe.parse({
    id: "5.56mm-nato.round",
    type: "round",
    name: "5.56mm NATO round",
    description: [{ text: "Test round" }],
    weight: 0.01231,
    renderable: { default: [{ imageId: "5.56mm-nato" }] },
    projectile: PROJECTILE
});

const BUCKSHOT_RECIPE = ItemRecipe.parse({
    id: "12-gauge-buckshot.round",
    type: "round",
    name: "12 Gauge Buckshot",
    description: [{ text: "Test buckshot" }],
    weight: 0.028,
    renderable: { default: [{ imageId: "12-gauge" }] },
    projectile: { ...PROJECTILE, diameter: 18.5 }
});

const MAG_30_RECIPE = ItemRecipe.parse({
    id: "m16-30.magazine",
    type: "magazine",
    name: "M16 30 Round Magazine",
    description: [{ text: "Test mag" }],
    weight: 0.23,
    renderable: { default: [{ imageId: "m16-30" }] },
    slotProps: {
        ammo: { compatibleIds: ["5.56mm-nato.round"], maxQuantity: 30 }
    }
});

const MAG_20_RECIPE = ItemRecipe.parse({
    id: "m16-20.magazine",
    type: "magazine",
    name: "M16 20 Round Magazine",
    description: [{ text: "Test mag" }],
    weight: 0.18,
    renderable: { default: [{ imageId: "m16-20" }] },
    slotProps: {
        ammo: { compatibleIds: ["5.56mm-nato.round"], maxQuantity: 20 }
    },
    slots: { ammo: { id: "5.56mm-nato.round", quantity: 20 } }
});

const EMPTY_GUN_RECIPE = ItemRecipe.parse({
    id: "m4.gun",
    type: "gun",
    name: "M4",
    description: [{ text: "Test gun" }],
    weight: 2.92,
    renderable: { default: [{ imageId: "m4" }] },
    fireSelector: "single",
    fireType: "direct",
    fireModes: SINGLE_FIRE_MODES,
    slotProps: {
        ammo: { compatibleIds: ["m16-30.magazine", "m16-20.magazine"] }
    }
});

const LOADED_GUN_RECIPE = ItemRecipe.parse({
    id: "m4-loaded.gun",
    type: "gun",
    name: "M4 Loaded",
    description: [{ text: "Test gun with mag" }],
    weight: 2.92,
    renderable: { default: [{ imageId: "m4" }] },
    fireSelector: "single",
    fireType: "direct",
    fireModes: SINGLE_FIRE_MODES,
    slotProps: {
        ammo: { compatibleIds: ["m16-30.magazine", "m16-20.magazine"] }
    },
    slots: { ammo: { id: "m16-20.magazine" } }
});

const COMBO_RECIPE = ItemRecipe.parse({
    id: "m4+m203.gun",
    type: "item",
    name: "M4+M203",
    description: [{ text: "Combo weapon" }],
    weight: 0,
    renderable: { default: [{ imageId: "m4+m203" }] },
    slotProps: { "0": {}, "1": {} },
    slots: { "0": { id: "m4-loaded.gun" } }
});

const TOKEN_RECIPE = ItemRecipe.parse({
    id: "coffee-token.item",
    type: "item",
    name: "Coffee Token",
    description: [{ text: "Test token" }],
    weight: 0.01,
    renderable: { default: [{ imageId: "coffee-token" }] }
});

const GRENADE_ROUND_RECIPE = ItemRecipe.parse({
    id: "40mm-he.round",
    type: "round",
    name: "40mm HE",
    description: [{ text: "Test grenade" }],
    weight: 0.368,
    renderable: { default: [{ imageId: "40mm-he" }] },
    projectile: { ...PROJECTILE, diameter: 40, velocity: 84 }
});

const SMOKE_ROUND_RECIPE = ItemRecipe.parse({
    id: "40mm-smoke.round",
    type: "round",
    name: "40mm Smoke",
    description: [{ text: "Test smoke grenade" }],
    weight: 0.368,
    renderable: { default: [{ imageId: "40mm-smoke" }] },
    projectile: { ...PROJECTILE, diameter: 40, velocity: 84 }
});

const GRENADE_LAUNCHER_RECIPE = ItemRecipe.parse({
    id: "m203.gun",
    type: "gun",
    name: "M203",
    description: [{ text: "Test grenade launcher" }],
    weight: 1.36,
    renderable: { default: [] },
    fireSelector: "single",
    fireType: "indirect",
    fireModes: SINGLE_FIRE_MODES,
    slotProps: {
        ammo: { compatibleIds: ["40mm-he.round", "40mm-smoke.round"], maxQuantity: 1 }
    },
    slots: { ammo: { id: "40mm-he.round", quantity: 1 } }
});

const DISPOSABLE_LAUNCHER_RECIPE = ItemRecipe.parse({
    id: "law.gun",
    type: "gun",
    name: "LAW",
    description: [{ text: "Disposable launcher" }],
    weight: 4.4,
    renderable: { default: [] },
    fireSelector: "single",
    fireType: "direct",
    fireModes: SINGLE_FIRE_MODES,
    allowLoad: false,
    allowUnload: false,
    slotProps: {
        ammo: { compatibleIds: ["40mm-he.round"], maxQuantity: 1 }
    },
    slots: { ammo: { id: "40mm-he.round", quantity: 1 } }
});

const PARTIAL_MAG_RECIPE = ItemRecipe.parse({
    id: "m16-30-partial.magazine",
    type: "magazine",
    name: "M16 Partial Magazine",
    description: [{ text: "Test mag" }],
    weight: 0.23,
    renderable: { default: [{ imageId: "m16-30" }] },
    slotProps: {
        ammo: { compatibleIds: ["5.56mm-nato.round"], maxQuantity: 30 }
    },
    slots: { ammo: { id: "5.56mm-nato.round", quantity: 10 } }
});

function createItemManager(): ItemManager {
    const recipes = new ItemRecipeManager();
    for (const recipe of [
        ROUND_RECIPE,
        BUCKSHOT_RECIPE,
        MAG_30_RECIPE,
        MAG_20_RECIPE,
        EMPTY_GUN_RECIPE,
        LOADED_GUN_RECIPE,
        COMBO_RECIPE,
        TOKEN_RECIPE,
        PARTIAL_MAG_RECIPE,
        GRENADE_ROUND_RECIPE,
        SMOKE_ROUND_RECIPE,
        GRENADE_LAUNCHER_RECIPE,
        DISPOSABLE_LAUNCHER_RECIPE
    ]) {
        recipes.addRecipe(recipe);
    }
    return new ItemManager(recipes);
}

describe("Item", () => {
    let itemManager: ItemManager;

    beforeEach(() => {
        itemManager = createItemManager();
    });

    describe("load", () => {
        it("loads a magazine into an empty gun and returns null", () => {
            const gun = itemManager.newItem(EMPTY_GUN_RECIPE.id);
            const mag = itemManager.newItem(MAG_30_RECIPE.id);

            expect(gun.findSlotContents(SlotType.enum.ammo)).toBeUndefined();

            const previous = gun.load(mag);

            expect(previous).toBeNull();
            expect(gun.findSlotContents(SlotType.enum.ammo)).toBe(mag);
        });

        it("swaps magazines and returns the previous magazine", () => {
            const gun = itemManager.newItem(LOADED_GUN_RECIPE.id);
            const originalMag = gun.getSlotContents(SlotType.enum.ammo);
            const replacement = itemManager.newItem(MAG_30_RECIPE.id);

            const previous = gun.load(replacement);

            expect(previous).toBe(originalMag);
            expect(gun.findSlotContents(SlotType.enum.ammo)).toBe(replacement);
        });

        it("loads rounds into an empty magazine", () => {
            const mag = itemManager.newItem(MAG_30_RECIPE.id);
            const rounds = itemManager.newItem(ROUND_RECIPE.id, { quantity: 8 });

            expect(mag.findSlotContents(SlotType.enum.ammo)).toBeUndefined();

            const leftover = mag.load(rounds);

            expect(leftover).toBeNull();
            expect(mag.capacity).toBe(8);
            expect(mag.findSlotContents(SlotType.enum.ammo)?.recipeId).toBe(ROUND_RECIPE.id);
        });

        it("tops up rounds and returns leftover ammo", () => {
            const mag = itemManager.newItem(PARTIAL_MAG_RECIPE.id);
            const rounds = itemManager.newItem(ROUND_RECIPE.id, { quantity: 25 });

            expect(mag.capacity).toBe(10);

            const leftover = mag.load(rounds);

            expect(mag.capacity).toBe(30);
            expect(leftover).toBe(rounds);
            expect(leftover?.quantity).toBe(5);
        });

        it("rejects incompatible ammo", () => {
            const mag = itemManager.newItem(MAG_30_RECIPE.id);
            const buckshot = itemManager.newItem(BUCKSHOT_RECIPE.id, { quantity: 4 });

            expect(() => mag.load(buckshot)).toThrow(/not a compatible ammo/);
        });

        it("rejects load when the item has no ammo slot", () => {
            const token = itemManager.newItem(TOKEN_RECIPE.id);
            const mag = itemManager.newItem(MAG_30_RECIPE.id);

            expect(() => token.load(mag)).toThrow(/cannot be loaded/);
        });

        it("swaps a chambered grenade and returns the previous round", () => {
            const launcher = itemManager.newItem(GRENADE_LAUNCHER_RECIPE.id);
            const chambered = launcher.getSlotContents(SlotType.enum.ammo);
            const replacement = itemManager.newItem(SMOKE_ROUND_RECIPE.id);

            const previous = launcher.load(replacement);

            expect(previous).toBe(chambered);
            expect(launcher.findSlotContents(SlotType.enum.ammo)).toBe(replacement);
        });

        it("replaces a chambered grenade with another of the same type", () => {
            const launcher = itemManager.newItem(GRENADE_LAUNCHER_RECIPE.id);
            const chambered = launcher.getSlotContents(SlotType.enum.ammo);
            const replacement = itemManager.newItem(GRENADE_ROUND_RECIPE.id);

            const previous = launcher.load(replacement);

            expect(previous).toBe(chambered);
            expect(launcher.findSlotContents(SlotType.enum.ammo)).toBe(replacement);
        });

        it("takes one round from a stack when swapping a single-capacity chamber", () => {
            const launcher = itemManager.newItem(GRENADE_LAUNCHER_RECIPE.id);
            const chambered = launcher.getSlotContents(SlotType.enum.ammo);
            const stack = itemManager.newItem(SMOKE_ROUND_RECIPE.id, { quantity: 3 });

            expect(launcher.replacesAmmoAsWholeItem(stack)).toBe(true);

            const previous = launcher.load(stack);
            const loaded = launcher.getSlotContents(SlotType.enum.ammo);

            expect(previous).toBe(chambered);
            expect(loaded).not.toBe(stack);
            expect(loaded.recipeId).toBe(SMOKE_ROUND_RECIPE.id);
            expect(loaded.quantity).toBe(1);
            expect(stack.quantity).toBe(2);
        });
    });

    describe("unload", () => {
        it("returns null when the ammo slot is empty", () => {
            const gun = itemManager.newItem(EMPTY_GUN_RECIPE.id);

            expect(gun.unload()).toBeNull();
        });

        it("returns the magazine and clears the slot", () => {
            const gun = itemManager.newItem(LOADED_GUN_RECIPE.id);
            const mag = gun.getSlotContents(SlotType.enum.ammo);

            expect(gun.unload()).toBe(mag);
            expect(gun.findSlotContents(SlotType.enum.ammo)).toBeUndefined();
        });

        it("rejects load and unload when the recipe disables them", () => {
            const law = itemManager.newItem(DISPOSABLE_LAUNCHER_RECIPE.id);
            const spare = itemManager.newItem(GRENADE_ROUND_RECIPE.id);

            expect(law.canLoad()).toBe(false);
            expect(law.canUnload()).toBe(false);
            expect(law.toInventoryItemView().allowLoad).toBe(false);
            expect(law.toInventoryItemView().allowUnload).toBe(false);
            expect(() => law.load(spare)).toThrow(/cannot be loaded/);
            expect(() => law.unload()).toThrow(/cannot be unloaded/);
            expect(law.findSlotContents(SlotType.enum.ammo)?.recipeId).toBe("40mm-he.round");
        });

        it("keeps sealed ammo when stripping store components for a sale", () => {
            const law = itemManager.newItem(DISPOSABLE_LAUNCHER_RECIPE.id);
            const rocket = law.getSlotContents(SlotType.enum.ammo);

            const sold = law.removeStoreComponents(
                (recipeId) =>
                    recipeId === DISPOSABLE_LAUNCHER_RECIPE.id ||
                    recipeId === GRENADE_ROUND_RECIPE.id,
                true
            );

            expect(sold.map((item) => item.recipeId)).toEqual([DISPOSABLE_LAUNCHER_RECIPE.id]);
            expect(law.findSlotContents(SlotType.enum.ammo)).toBe(rocket);
        });
    });

    describe("findByItemId", () => {
        it("finds a nested magazine through a combo weapon", () => {
            const combo = itemManager.newItem(COMBO_RECIPE.id);
            const gun = combo.getSlotContents(SlotType.enum[0]);
            const mag = gun.getSlotContents(SlotType.enum.ammo);

            expect(combo.findByItemId(mag.id)).toBe(mag);
            expect(combo.getByItemId(mag.id)).toBe(mag);
            expect(combo.findByItemId(gun.id)).toBe(gun);
            expect(combo.findByItemId(combo.id)).toBe(combo);
        });

        it("returns undefined when the nested item does not exist", () => {
            const combo = itemManager.newItem(COMBO_RECIPE.id);

            expect(combo.findByItemId("missing-item")).toBeUndefined();
            expect(() => combo.getByItemId("missing-item")).toThrow(/did not have a sub-item/);
        });
    });
});

describe("Inventory", () => {
    it("exposes items and clears them on dropAllItem", () => {
        const itemManager = createItemManager();
        const inventory = new Inventory(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: TOKEN_RECIPE.id }, { id: EMPTY_GUN_RECIPE.id }]
            }),
            itemManager
        );

        expect(inventory.items).toHaveLength(2);
        expect(inventory.itemInUse?.recipeId).toBe(TOKEN_RECIPE.id);

        const dropped = inventory.dropAllItem();

        expect(dropped).toHaveLength(2);
        expect(inventory.items).toHaveLength(0);
        expect(inventory.itemInUse).toBeNull();
        expect(inventory.findItem(dropped[0].id)).toBeUndefined();
    });

    it("reorders items and keeps in-use identity", () => {
        const itemManager = createItemManager();
        const inventory = new Inventory(
            InventoryRecipe.parse({
                inUse: 0,
                items: [
                    { id: TOKEN_RECIPE.id },
                    { id: EMPTY_GUN_RECIPE.id },
                    { id: MAG_30_RECIPE.id }
                ]
            }),
            itemManager
        );

        const inUseId = inventory.itemInUse!.id;
        const [firstId, secondId, thirdId] = inventory.items.map(({ id }) => id);

        inventory.reorderItem(0, 2);

        expect(inventory.items.map(({ id }) => id)).toEqual([secondId, thirdId, firstId]);
        expect(inventory.itemInUse?.id).toBe(inUseId);

        inventory.reorderItem(2, 0);

        expect(inventory.items.map(({ id }) => id)).toEqual([firstId, secondId, thirdId]);
        expect(inventory.itemInUse?.id).toBe(inUseId);
    });

    it("appends new items unless an index is given", () => {
        const itemManager = createItemManager();
        const inventory = new Inventory(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: TOKEN_RECIPE.id }, { id: EMPTY_GUN_RECIPE.id }]
            }),
            itemManager
        );
        const mag = itemManager.newItem(MAG_30_RECIPE.id);
        const extraToken = itemManager.newItem(TOKEN_RECIPE.id);

        inventory.addItem(mag);

        expect(inventory.items.map(({ recipeId }) => recipeId)).toEqual([
            TOKEN_RECIPE.id,
            EMPTY_GUN_RECIPE.id,
            MAG_30_RECIPE.id
        ]);

        inventory.addItem(extraToken, 1);

        expect(inventory.items.map(({ recipeId }) => recipeId)).toEqual([
            TOKEN_RECIPE.id,
            TOKEN_RECIPE.id,
            EMPTY_GUN_RECIPE.id,
            MAG_30_RECIPE.id
        ]);
    });
});

describe("TileRecipe.items", () => {
    it("keeps seeded ground items instead of stripping them", () => {
        const recipe = TileRecipe.parse({
            terrain: { id: "grass" },
            items: [{ id: "coffee-token.item" }]
        });

        expect(recipe.items).toEqual([{ id: "coffee-token.item" }]);
    });

    it("spawns ground items onto tiles when the map is created", () => {
        const terrainManager = TerrainManager.GetSingleton();
        if (!terrainManager.has("grass")) {
            terrainManager.add(
                new Terrain(
                    TerrainRecipe.parse({
                        id: "grass",
                        name: "Grass",
                        category: "terrain",
                        description: [{ text: "Grass" }],
                        renderable: { default: [{ imageId: "grass" }] }
                    })
                )
            );
        }

        const itemManager = createItemManager();
        const furnitureManager = new FurnitureManager(
            new FurnitureRecipeManager(),
            new MaterialManager()
        );
        const game = { id: "ITEM-TEST", furnitureManager, itemManager } as Game;
        const visibilityManager = new VisibilityManager(game);
        Object.assign(game, { visibilityManager });

        const map = new WorldMap(
            MapRecipe.parse({
                id: "item-seed.map",
                name: "Item Seed",
                width: 1,
                height: 1,
                tileSize: 100,
                tiles: [
                    [
                        {
                            terrain: { id: "grass" },
                            items: [{ id: TOKEN_RECIPE.id }]
                        }
                    ]
                ]
            }),
            game
        );

        const tile = map.getTile(new TilePos(0, 0));
        expect(tile.items).toHaveLength(1);
        expect(tile.items[0].recipeId).toBe(TOKEN_RECIPE.id);
        expect(tile.items[0].location).toEqual(new TilePos(0, 0));
    });
});
