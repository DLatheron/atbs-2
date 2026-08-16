import { beforeEach, describe, expect, it, vi } from "vitest";
import { FireMode, FireModeEx, FireSelector, getFireModeDetails } from "@atbs/shared-data";
import { Orientation } from "@atbs/maths";
import type { Game } from "./Game.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipe } from "./ItemRecipe.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { MaterialRecipe } from "./Material.js";
import type { Side } from "./Side.js";
import { Unit, UnitRecipe } from "./Unit.js";

function ensureHumanMaterial(): void {
    const materials = MaterialManager.GetSingleton();
    if (materials.hasMaterial("human.material")) {
        return;
    }

    materials.addMaterial(
        MaterialRecipe.parse({
            id: "human.material",
            category: "unit",
            rgb: { r: 248, g: 238, b: 0 },
            densityMap: { default: 3, eyeball: 100 },
            hardness: 0.15,
            toughness: 0.25,
            roughness: 0,
            elasticity: 0,
            density: 0.2
        })
    );
}

function testUnitRecipe(): UnitRecipe {
    return UnitRecipe.parse({
        id: "unit-1",
        name: "Test Unit",
        description: [{ text: "Test" }],
        attributes: {
            weight: 80,
            actionPoints: { max: 40 },
            constitution: { max: 50 },
            fitness: { max: 50 },
            morale: { max: 50 },
            stamina: { max: 50 },
            speed: { max: 50 },
            strength: { max: 50 }
        },
        inventory: { inUse: null, items: [] },
        collision: {
            shape: "circle",
            radius: 24,
            materials: ["human.material"]
        },
        renderable: {
            UI_MODE: {
                alive: { default: [{ imageId: "generic-4" }] },
                default: []
            },
            MAP_MODE: {
                alive: { default: [{ imageId: "generic-0" }] },
                default: []
            },
            FIRE_MODE: {
                default: [{ imageId: "generic-cl" }]
            },
            default: []
        },
        actions: {
            throw: {
                accuracy: 40,
                actionPoints: 20
            }
        }
    });
}

function gunRecipe(id: string) {
    return ItemRecipe.parse({
        id,
        type: "gun",
        name: "Test Gun",
        shortName: "Gun",
        description: [{ text: "Test" }],
        weight: 3,
        renderable: {
            default: [{ imageId: "generic-4" }],
            FIRE_MODE: []
        },
        fireType: "direct",
        fireSelector: "single",
        fireModes: {
            single: {
                ammoUse: 1,
                fireModeDetails: {
                    aimed: { accuracy: 80, actionPoints: 25 },
                    snapshot: { accuracy: 50, actionPoints: 10 }
                }
            }
        }
    });
}

function grenadeRecipe() {
    return ItemRecipe.parse({
        id: "test.grenade",
        type: "grenade",
        name: "Test Grenade",
        description: [{ text: "Test" }],
        weight: 0.4,
        renderable: {
            default: [{ imageId: "generic-4" }],
            FIRE_MODE: []
        },
        explosion: {
            type: "fragment",
            maxRange: 80,
            numFragments: 8,
            visual: {
                intensity: 1,
                velocity: 400,
                length: 10,
                rangeFallOff: 10
            },
            damage: { default: 1 }
        }
    });
}

function comboRecipe() {
    return ItemRecipe.parse({
        id: "test.combo",
        type: "item",
        name: "Test Combo",
        shortName: "Combo",
        description: [{ text: "Test" }],
        weight: 0,
        renderable: {
            default: [{ imageId: "generic-4" }],
            FIRE_MODE: []
        },
        slotProps: { "0": {}, "1": {} },
        slots: {
            "0": { id: "test.gun.a" },
            "1": { id: "test.gun.b" }
        }
    });
}

describe("Unit fire-mode preference", () => {
    let unit: Unit;
    let itemManager: ItemManager;

    beforeEach(() => {
        ensureHumanMaterial();

        const itemRecipeManager = new ItemRecipeManager();
        itemRecipeManager.addRecipe(gunRecipe("test.gun.a"));
        itemRecipeManager.addRecipe(gunRecipe("test.gun.b"));
        itemRecipeManager.addRecipe(grenadeRecipe());
        itemRecipeManager.addRecipe(comboRecipe());
        itemManager = new ItemManager(itemRecipeManager);

        const game = {
            itemManager,
            visibilityManager: {
                addViewer: vi.fn(),
                invalidateViewerLocation: vi.fn(),
                invalidateViewerOrientation: vi.fn()
            },
            messageRouter: {
                sendIfVisible: vi.fn(),
                send: vi.fn()
            }
        } as unknown as Game;

        unit = new Unit(
            testUnitRecipe(),
            { orientation: Orientation.NORTH },
            { side: { id: "side-1" } as Side },
            game
        );
    });

    it("defaults new units to aimed", () => {
        expect(unit.fireMode).toBe(FireMode.enum.aimed);
    });

    it("derives fireModeEx from the unit preference for guns", () => {
        const gun = itemManager.newItem("test.gun.a");
        unit.inventory.addItem(gun);
        unit.inventory.selectItem(gun);

        expect(gun.getFireModeItemSummary(unit).fireModeEx).toBe(FireModeEx.enum.aimed);

        unit.fireMode = FireMode.enum.snapshot;

        expect(gun.getFireModeItemSummary(unit).fireModeEx).toBe(FireModeEx.enum.snapshot);
        expect(unit.fireMode).toBe(FireMode.enum.snapshot);
    });

    it("derives fireModeEx as throw for grenades", () => {
        const grenade = itemManager.newItem("test.grenade");
        unit.inventory.addItem(grenade);
        unit.inventory.selectItem(grenade);

        expect(grenade.getFireModeItemSummary(unit).fireModeEx).toBe(FireModeEx.enum.throw);
        expect(unit.fireMode).toBe(FireMode.enum.aimed);
    });

    it("derives fireModeEx from the unit preference for composite weapons", () => {
        const combo = itemManager.newItem("test.combo");
        unit.inventory.addItem(combo);
        unit.inventory.selectItem(combo);

        expect(combo.getFireModeItemSummary(unit).weapons).toHaveLength(2);
        expect(combo.getFireModeItemSummary(unit).fireModeEx).toBe(FireModeEx.enum.aimed);

        unit.fireMode = FireMode.enum.snapshot;

        expect(combo.getFireModeItemSummary(unit).fireModeEx).toBe(FireModeEx.enum.snapshot);
    });

    it("does not reset weapon index when the fire-mode preference changes", () => {
        const combo = itemManager.newItem("test.combo");
        unit.inventory.addItem(combo);
        unit.inventory.selectItem(combo);
        unit.setWeaponIndex(1);

        expect(unit.inventory.weaponIndex).toBe(1);

        unit.fireMode = FireMode.enum.snapshot;

        expect(unit.inventory.weaponIndex).toBe(1);
        expect(combo.getFireModeItemSummary(unit).weaponIndex).toBe(1);
        expect(unit.fireMode).toBe(FireMode.enum.snapshot);
    });

    it("resets weapon index on item switch without changing the fire-mode preference", () => {
        const combo = itemManager.newItem("test.combo");
        const gun = itemManager.newItem("test.gun.a");
        unit.inventory.addItem(combo);
        unit.inventory.addItem(gun);
        unit.inventory.selectItem(combo);
        unit.setWeaponIndex(1);
        unit.fireMode = FireMode.enum.snapshot;

        unit.inventory.selectItem(gun);

        expect(unit.inventory.weaponIndex).toBe(0);
        expect(unit.fireMode).toBe(FireMode.enum.snapshot);
        expect(gun.getFireModeItemSummary(unit).weaponIndex).toBe(0);
        expect(gun.getFireModeItemSummary(unit).fireModeEx).toBe(FireModeEx.enum.snapshot);
    });

    it("sets available flags from action points without changing fireMode", () => {
        const gun = itemManager.newItem("test.gun.a");
        unit.inventory.addItem(gun);
        unit.inventory.selectItem(gun);

        const detailsAtFull = getFireModeDetails(
            gun.getFireModeItemSummary(unit).weapons[0].fireModes,
            FireSelector.enum.single
        );
        expect(detailsAtFull.aimed.available).toBe(true);
        expect(detailsAtFull.snapshot.available).toBe(true);
        expect(unit.getActions().throw.available).toBe(true);
        expect(unit.fireMode).toBe(FireMode.enum.aimed);

        unit.actionPoints = 12;

        const detailsAtLow = getFireModeDetails(
            gun.getFireModeItemSummary(unit).weapons[0].fireModes,
            FireSelector.enum.single
        );
        expect(detailsAtLow.aimed.available).toBe(false);
        expect(detailsAtLow.snapshot.available).toBe(true);
        expect(gun.getFireModeItemSummary(unit).fireModeEx).toBe(FireModeEx.enum.aimed);
        expect(unit.fireMode).toBe(FireMode.enum.aimed);

        unit.actionPoints = 5;

        const detailsAtVeryLow = getFireModeDetails(
            gun.getFireModeItemSummary(unit).weapons[0].fireModes,
            FireSelector.enum.single
        );
        expect(detailsAtVeryLow.aimed.available).toBe(false);
        expect(detailsAtVeryLow.snapshot.available).toBe(false);
        expect(unit.getActions().throw.available).toBe(false);
        expect(unit.fireMode).toBe(FireMode.enum.aimed);
    });

    it("rejects an out-of-range weapon index", () => {
        const gun = itemManager.newItem("test.gun.a");
        unit.inventory.addItem(gun);
        unit.inventory.selectItem(gun);

        expect(() => unit.setWeaponIndex(1)).toThrow(/out of range/);

        const combo = itemManager.newItem("test.combo");
        unit.inventory.addItem(combo);
        unit.inventory.selectItem(combo);

        expect(() => unit.setWeaponIndex(2)).toThrow(/out of range/);
        expect(() => unit.setWeaponIndex(1)).not.toThrow();
    });
});
