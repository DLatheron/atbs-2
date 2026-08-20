import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TilePos } from "@atbs/maths";
import { ErrorType } from "@atbs/shared-data";
import { config } from "../config/config.schema.js";
import type { Game } from "./Game.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { InventoryRecipe } from "./Inventory.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipe, SlotType } from "./ItemRecipe.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { MaterialRecipe } from "./Material.js";
import { MaterialManager } from "./MaterialManager.js";
import type { Side } from "./Side.js";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { Unit, UnitRecipe } from "./Unit.js";
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
        MAG_30_RECIPE,
        MAG_20_RECIPE,
        EMPTY_GUN_RECIPE,
        LOADED_GUN_RECIPE,
        COMBO_RECIPE,
        TOKEN_RECIPE,
        PARTIAL_MAG_RECIPE,
        GRENADE_ROUND_RECIPE,
        SMOKE_ROUND_RECIPE,
        GRENADE_LAUNCHER_RECIPE
    ]) {
        recipes.addRecipe(recipe);
    }
    return new ItemManager(recipes);
}

function ensureGrass(): void {
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
}

function ensureHumanMaterial(): void {
    const materialManager = MaterialManager.GetSingleton();
    if (!materialManager.hasMaterial("human.material")) {
        materialManager.addMaterial(
            MaterialRecipe.parse({
                id: "human.material",
                category: "unit",
                rgb: { r: 248, g: 238, b: 0 },
                densityMap: { default: 3, eyeball: 100 },
                hardness: 0.15,
                toughness: 0.25,
                roughness: 0.0,
                elasticity: 0.0,
                density: 0.2
            })
        );
    }
}

function sentMessages(messageRouter: { send: ReturnType<typeof vi.fn> }) {
    return messageRouter.send.mock.calls.flatMap(([message]) =>
        Array.isArray(message) ? message : [message]
    );
}

function createHarness(inventory: InventoryRecipe) {
    ensureGrass();
    ensureHumanMaterial();

    const itemManager = createItemManager();
    const furnitureManager = new FurnitureManager(
        new FurnitureRecipeManager(),
        new MaterialManager()
    );

    const side = {
        id: "side-0",
        oppositionSideIds: [] as string[],
        units: [] as Unit[]
    };

    const messageRouter = {
        send: vi.fn(),
        sendIfVisible: vi.fn()
    };

    const game = {
        id: "INV-TEST",
        itemManager,
        furnitureManager,
        sides: [side],
        messageRouter,
        opportunityFireManager: {
            registerOpportunity: vi.fn()
        },
        getOppositionUnitsForSide: () => [],
        syncUnitsCanSee(callback?: (unit: Unit) => void) {
            for (const unit of side.units) {
                callback?.(unit);
            }
        }
    } as unknown as Game;

    const visibilityManager = new VisibilityManager(game);
    Object.assign(game, { visibilityManager });

    const map = new WorldMap(
        MapRecipe.parse({
            id: "inv-test.map",
            name: "Inv Test",
            width: 1,
            height: 1,
            tileSize: 100,
            tiles: [[{ terrain: { id: "grass" } }]]
        }),
        game
    );
    Object.assign(game, { map });

    const unit = new Unit(
        UnitRecipe.parse({
            id: "test-unit.unit",
            name: "Test Unit",
            description: [{ text: "Test" }],
            attributes: {
                actionPoints: { max: 47, value: 47 },
                constitution: { max: 50 },
                fitness: { max: 80 },
                morale: { max: 82 },
                stamina: { max: 60 },
                speed: { max: 50 },
                strength: { max: 52 },
                weight: 85
            },
            inventory,
            collision: {
                shape: "circle",
                radius: 24,
                materials: ["human.material"]
            },
            renderable: { default: [] },
            actions: { throw: { accuracy: 40, actionPoints: 20 } }
        }),
        { location: { col: 0, row: 0 } },
        { side: side as unknown as Side },
        game
    );

    const tile = map.getTile(new TilePos(0, 0));
    tile.addUnit(unit);
    side.units.push(unit);

    return { game, unit, tile, itemManager, messageRouter };
}

describe("Unit inventory", () => {
    const originalInfiniteActionPoints = config.infiniteActionPoints;

    beforeEach(() => {
        config.infiniteActionPoints = false;
    });

    afterEach(() => {
        config.infiniteActionPoints = originalInfiniteActionPoints;
    });

    it("enables canInventory for a living unit", () => {
        const { unit } = createHarness(
            InventoryRecipe.parse({ inUse: null, items: [{ id: TOKEN_RECIPE.id }] })
        );

        expect(unit.canInventory).toBe(true);
    });

    it("debits 8 AP to use a backpack item", () => {
        const { unit } = createHarness(
            InventoryRecipe.parse({ inUse: null, items: [{ id: TOKEN_RECIPE.id }] })
        );
        const token = unit.inventory.items[0];

        expect(unit.useItem(token.id)).toBe(true);
        expect(unit.itemInUse?.id).toBe(token.id);
        expect(unit.actionPoints).toBe(39);
    });

    it("debits 12 AP to switch the in-use item", () => {
        const { unit } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: TOKEN_RECIPE.id }, { id: EMPTY_GUN_RECIPE.id }]
            })
        );
        const gun = unit.inventory.items[1];

        expect(unit.useItem(gun.id)).toBe(true);
        expect(unit.itemInUse?.id).toBe(gun.id);
        expect(unit.actionPoints).toBe(35);
    });

    it("does not mutate on insufficient AP", () => {
        const { unit, messageRouter } = createHarness(
            InventoryRecipe.parse({ inUse: null, items: [{ id: TOKEN_RECIPE.id }] })
        );
        const token = unit.inventory.items[0];
        unit.actionPoints = 3;

        expect(unit.useItem(token.id)).toBe(false);
        expect(unit.itemInUse).toBeNull();
        expect(unit.actionPoints).toBe(3);
        expect(sentMessages(messageRouter)).toContainEqual({
            type: "server:error",
            payload: ErrorType.enum.INSUFFICIENT_ACTION_POINTS
        });
    });

    it("drops the in-use item onto the current tile", () => {
        const { unit, tile, messageRouter } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: TOKEN_RECIPE.id }, { id: EMPTY_GUN_RECIPE.id }]
            })
        );
        const token = unit.itemInUse!;

        expect(unit.dropItem(token.id)).toBe(true);
        expect(unit.itemInUse).toBeNull();
        expect(unit.inventory.findItem(token.id)).toBeUndefined();
        expect(tile.items.map(({ id }) => id)).toEqual([token.id]);
        expect(token.location).toEqual(new TilePos(0, 0));
        expect(unit.actionPoints).toBe(43);
        expect(messageRouter.sendIfVisible).toHaveBeenCalled();
    });

    it("drops a backpack item onto the current tile", () => {
        const { unit, tile } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: TOKEN_RECIPE.id }, { id: EMPTY_GUN_RECIPE.id }]
            })
        );
        const backpackGun = unit.inventory.items[1];

        expect(unit.dropItem(backpackGun.id)).toBe(true);
        expect(unit.itemInUse?.recipeId).toBe(TOKEN_RECIPE.id);
        expect(unit.inventory.findItem(backpackGun.id)).toBeUndefined();
        expect(tile.items.map(({ id }) => id)).toEqual([backpackGun.id]);
        expect(unit.actionPoints).toBe(43);
    });

    it("unloads a chambered item onto the ground when dropping it", () => {
        const { unit, tile } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: LOADED_GUN_RECIPE.id }]
            })
        );
        const gun = unit.itemInUse!;
        const mag = gun.getSlotContents(SlotType.enum.ammo);

        expect(unit.dropItem(mag.id)).toBe(true);
        expect(gun.findSlotContents(SlotType.enum.ammo)).toBeUndefined();
        expect(unit.inventory.findItem(mag.id)).toBeUndefined();
        expect(tile.items.map(({ id }) => id)).toEqual([mag.id]);
        expect(unit.actionPoints).toBe(35);
    });

    it("picks up a ground item into the backpack or into use", () => {
        const { unit, tile, itemManager } = createHarness(
            InventoryRecipe.parse({ inUse: null, items: [] })
        );
        const token = itemManager.newItem(TOKEN_RECIPE.id, { location: new TilePos(0, 0) });
        tile.addItem(token);

        expect(unit.pickupItem(token.id)).toBe(true);
        expect(unit.inventory.findItem(token.id)).toBe(token);
        expect(unit.itemInUse).toBeNull();
        expect(tile.items).toHaveLength(0);
        expect(token.location).toBeNull();
        expect(unit.actionPoints).toBe(35);

        const tokenToUse = itemManager.newItem(TOKEN_RECIPE.id, { location: new TilePos(0, 0) });
        tile.addItem(tokenToUse);
        unit.actionPoints = 47;

        expect(unit.pickupItem(tokenToUse.id, true)).toBe(true);
        expect(unit.itemInUse?.id).toBe(tokenToUse.id);
        expect(unit.inventory.items.map(({ id }) => id)).toEqual([token.id, tokenToUse.id]);
        expect(tile.items).toHaveLength(0);
        expect(unit.actionPoints).toBe(39);
    });

    it("loads a magazine from inventory into the in-use gun and swaps the previous mag", () => {
        const { unit } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: LOADED_GUN_RECIPE.id }, { id: MAG_30_RECIPE.id }]
            })
        );
        const gun = unit.itemInUse!;
        const originalMag = gun.getSlotContents(SlotType.enum.ammo);
        const spareMag = unit.inventory.items[1];

        expect(unit.loadItem(gun.id, spareMag.id)).toBe(true);
        expect(gun.findSlotContents(SlotType.enum.ammo)).toBe(spareMag);
        expect(unit.inventory.findItem(originalMag.id)).toBe(originalMag);
        expect(unit.inventory.findItem(spareMag.id)).toBeUndefined();
        expect(unit.actionPoints).toBe(39);
    });

    it("swaps a chambered 40mm grenade back into inventory when loading another", () => {
        const { unit } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: GRENADE_LAUNCHER_RECIPE.id }, { id: SMOKE_ROUND_RECIPE.id }]
            })
        );
        const launcher = unit.itemInUse!;
        const chambered = launcher.getSlotContents(SlotType.enum.ammo);
        const smoke = unit.inventory.items[1];

        expect(unit.loadItem(launcher.id, smoke.id)).toBe(true);
        expect(launcher.findSlotContents(SlotType.enum.ammo)).toBe(smoke);
        expect(unit.inventory.findItem(chambered.id)).toBe(chambered);
        expect(unit.inventory.findItem(smoke.id)).toBeUndefined();
        expect(unit.actionPoints).toBe(39);
    });

    it("swaps a chambered 40mm grenade with another of the same type", () => {
        const { unit } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: GRENADE_LAUNCHER_RECIPE.id }, { id: GRENADE_ROUND_RECIPE.id }]
            })
        );
        const launcher = unit.itemInUse!;
        const chambered = launcher.getSlotContents(SlotType.enum.ammo);
        const spare = unit.inventory.items[1];

        expect(unit.loadItem(launcher.id, spare.id)).toBe(true);
        expect(launcher.findSlotContents(SlotType.enum.ammo)).toBe(spare);
        expect(unit.inventory.findItem(chambered.id)).toBe(chambered);
        expect(unit.inventory.findItem(spare.id)).toBeUndefined();
    });

    it("loads one grenade from a stack into a chambered launcher and keeps the leftover", () => {
        const { unit, itemManager } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: GRENADE_LAUNCHER_RECIPE.id }]
            })
        );
        const launcher = unit.itemInUse!;
        const chambered = launcher.getSlotContents(SlotType.enum.ammo);
        const stack = itemManager.newItem(SMOKE_ROUND_RECIPE.id, { quantity: 2 });
        unit.inventory.addItem(stack);

        expect(unit.loadItem(launcher.id, stack.id)).toBe(true);

        const loaded = launcher.getSlotContents(SlotType.enum.ammo);
        expect(loaded.recipeId).toBe(SMOKE_ROUND_RECIPE.id);
        expect(loaded.quantity).toBe(1);
        expect(loaded).not.toBe(stack);
        expect(unit.inventory.findItem(stack.id)).toBe(stack);
        expect(stack.quantity).toBe(1);
        expect(unit.inventory.findItem(chambered.id)?.recipeId).toBe(GRENADE_ROUND_RECIPE.id);
        expect(unit.actionPoints).toBe(39);
    });

    it("loads leftover rounds from the ground and removes empty stacks", () => {
        const { unit, tile, itemManager } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: PARTIAL_MAG_RECIPE.id }]
            })
        );
        const mag = unit.itemInUse!;
        const rounds = itemManager.newItem(ROUND_RECIPE.id, {
            quantity: 25,
            location: new TilePos(0, 0)
        });
        tile.addItem(rounds);

        expect(unit.loadItem(mag.id, rounds.id)).toBe(true);
        expect(mag.capacity).toBe(30);
        expect(rounds.quantity).toBe(5);
        expect(tile.items).toContain(rounds);
        expect(unit.actionPoints).toBe(31);

        unit.actionPoints = 47;
        expect(() => unit.loadItem(mag.id, rounds.id)).toThrow(/already fully loaded/);
        expect(unit.actionPoints).toBe(47);
        expect(tile.items).toContain(rounds);

        mag.unload();
        expect(unit.loadItem(mag.id, rounds.id)).toBe(true);
        expect(mag.capacity).toBe(5);
        expect(tile.items).not.toContain(rounds);
        expect(unit.inventory.findItem(rounds.id)).toBeUndefined();
        expect(unit.actionPoints).toBe(31);
    });

    it("rejects load and unload on items that are not in the in-use tree", () => {
        const { unit } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [
                    { id: TOKEN_RECIPE.id },
                    { id: EMPTY_GUN_RECIPE.id },
                    { id: MAG_30_RECIPE.id }
                ]
            })
        );
        const gun = unit.inventory.items[1];
        const mag = unit.inventory.items[2];

        expect(() => unit.loadItem(gun.id, mag.id)).toThrow(/not the in-use item/);
        expect(() => unit.unloadItem(gun.id)).toThrow(/not the in-use item/);
    });

    it("unloads a magazine from the in-use gun into inventory", () => {
        const { unit } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: LOADED_GUN_RECIPE.id }, { id: TOKEN_RECIPE.id }]
            })
        );
        const gun = unit.itemInUse!;
        const mag = gun.getSlotContents(SlotType.enum.ammo);
        const token = unit.inventory.items[1];

        expect(unit.unloadItem(gun.id)).toBe(true);
        expect(gun.findSlotContents(SlotType.enum.ammo)).toBeUndefined();
        expect(unit.inventory.items.map(({ id }) => id)).toEqual([gun.id, token.id, mag.id]);
        expect(unit.actionPoints).toBe(39);
    });

    it("loads a nested gun inside a combo in-use item", () => {
        const { unit } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: COMBO_RECIPE.id }, { id: MAG_30_RECIPE.id }]
            })
        );
        const combo = unit.itemInUse!;
        const nestedGun = combo.getSlotContents(SlotType.enum[0]);
        const spareMag = unit.inventory.items[1];

        expect(unit.loadItem(nestedGun.id, spareMag.id)).toBe(true);
        expect(nestedGun.findSlotContents(SlotType.enum.ammo)).toBe(spareMag);
        expect(unit.actionPoints).toBe(39);
    });

    it("builds a nested snapshot including empty slots, costs, and ground items", () => {
        const { unit, tile, itemManager } = createHarness(
            InventoryRecipe.parse({
                inUse: 0,
                items: [{ id: EMPTY_GUN_RECIPE.id }, { id: TOKEN_RECIPE.id }]
            })
        );
        const groundToken = itemManager.newItem(TOKEN_RECIPE.id, { location: new TilePos(0, 0) });
        tile.addItem(groundToken);

        const snapshot = unit.toInventorySnapshot();
        const gunView = snapshot.items[0];
        const ammoSlot = gunView.slots.find((slot) => slot.slot === "ammo");

        expect(snapshot.unitId).toBe(unit.id);
        expect(snapshot.actionPoints).toEqual({ max: 47, value: 47 });
        expect(snapshot.costs).toEqual({
            use: 8,
            unuse: 4,
            drop: 4,
            pickup: 12,
            pickupAndUse: 8,
            load: 8,
            loadFromGround: 16,
            unload: 8
        });
        expect(snapshot.inUseItemId).toBe(unit.itemInUse?.id);
        expect(ammoSlot).toEqual({
            slot: "ammo",
            compatibleIds: ["m16-30.magazine", "m16-20.magazine"],
            maxQuantity: 1,
            contents: null
        });
        expect(snapshot.groundItems.map(({ id }) => id)).toEqual([groundToken.id]);
        expect(snapshot.groundItems[0].type).toBe("item");
    });
});
