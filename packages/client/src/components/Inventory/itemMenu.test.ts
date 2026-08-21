import { describe, expect, it } from "vitest";
import type { InventoryCosts, InventoryItemView, InventorySnapshot } from "@atbs/shared-data";
import {
    collectAmmoCounts,
    collectAmmoSlots,
    collectContentSlots,
    describeItemContents,
    findCompatibleAmmo,
    findHotkeyAction,
    formatAmmoCount,
    getItemMenu,
    getUseCost,
    matchesCompatibleId,
    resolveInventoryDrag,
    resolveItemMenuTarget
} from "./itemMenu.js";

const costs: InventoryCosts = {
    use: 8,
    unuse: 4,
    drop: 4,
    dropFromInventory: 8,
    pickup: 12,
    pickupAndUse: 8,
    load: 8,
    loadFromGround: 16,
    unload: 8
};

function makeItem(
    overrides: Partial<InventoryItemView> & Pick<InventoryItemView, "id" | "type">
): InventoryItemView {
    return {
        name: overrides.shortName ?? overrides.id,
        shortName: overrides.id,
        description: [{ text: overrides.id }],
        quantity: 1,
        weight: 1,
        maxThrowRange: 0,
        uiImage: [{ imageId: "placeholder" }],
        slots: [],
        ...overrides
    };
}

function makeSnapshot(
    overrides: Partial<InventorySnapshot> & Pick<InventorySnapshot, "items">
): InventorySnapshot {
    return {
        unitId: "unit-1",
        actionPoints: { value: 47, max: 47 },
        costs,
        inUseItemId: null,
        groundItems: [],
        ...overrides
    };
}

const magInPack = makeItem({
    id: "m16-30.magazine-2",
    type: "magazine",
    shortName: "M16x30",
    slots: [
        {
            slot: "ammo",
            compatibleIds: ["5.56mm-nato.round"],
            maxQuantity: 30,
            contents: makeItem({
                id: "5.56mm-nato.round-1",
                type: "round",
                shortName: "5.56",
                quantity: 30
            })
        }
    ]
});

const spareMag = makeItem({
    id: "m16-30.magazine-3",
    type: "magazine",
    shortName: "M16x30",
    slots: [
        {
            slot: "ammo",
            compatibleIds: ["5.56mm-nato.round"],
            maxQuantity: 30,
            contents: null
        }
    ]
});

const m4 = makeItem({
    id: "m4.gun-1",
    type: "gun",
    shortName: "M4",
    slots: [
        {
            slot: "ammo",
            compatibleIds: ["m16-30.magazine", "m16-20.magazine"],
            maxQuantity: 1,
            contents: magInPack
        }
    ]
});

const coffee = makeItem({
    id: "coffee-token.item-1",
    type: "item",
    shortName: "Coffee"
});

const m203 = makeItem({
    id: "m203.gun-1",
    type: "gun",
    shortName: "M203",
    slots: [
        {
            slot: "ammo",
            compatibleIds: ["40mm-he.round"],
            maxQuantity: 1,
            contents: makeItem({
                id: "40mm-he.round-1",
                type: "round",
                shortName: "40mm HE",
                quantity: 1
            })
        }
    ]
});

const combo = makeItem({
    id: "m4+m203.gun-1",
    type: "item",
    shortName: "M4/M203",
    slots: [
        {
            slot: "0",
            compatibleIds: ["m4.gun"],
            maxQuantity: 1,
            contents: m4
        },
        {
            slot: "1",
            compatibleIds: ["m203.gun"],
            maxQuantity: 1,
            contents: m203
        }
    ]
});

describe("matchesCompatibleId", () => {
    it("matches recipe id and instance-suffixed ids", () => {
        expect(matchesCompatibleId("m16-30.magazine", "m16-30.magazine")).toBe(true);
        expect(matchesCompatibleId("m16-30.magazine-1", "m16-30.magazine")).toBe(true);
        expect(matchesCompatibleId("m16-20.magazine-1", "m16-30.magazine")).toBe(false);
        expect(matchesCompatibleId("5.56mm-nato.round-1", "m16-30.magazine")).toBe(false);
    });
});

describe("getItemMenu", () => {
    it("offers Use and Drop for a backpack item when actionScope is inUse", () => {
        const snapshot = makeSnapshot({ items: [m4, coffee], inUseItemId: m4.id });
        const rows = getItemMenu({
            snapshot,
            item: coffee,
            location: "inventory",
            actionScope: "inUse"
        });

        expect(rows.map((row) => row.id)).toEqual(["use", "drop"]);
        expect(rows[0]?.action).toEqual({ type: "use", itemId: coffee.id });
        expect(rows[0]?.cost).toBe(12);
        expect(rows[0]?.pendingCostText).toBe("Use Coffee — 12 APts");
        expect(rows[1]?.action).toEqual({ type: "drop", itemId: coffee.id });
        expect(rows[1]?.cost).toBe(8);
        expect(rows[1]?.pendingCostText).toBe("Drop Coffee — 8 APts");
    });

    it("offers Load on a backpack magazine compatible with the in-use weapon", () => {
        const snapshot = makeSnapshot({
            items: [m4, spareMag],
            inUseItemId: m4.id
        });
        const rows = getItemMenu({
            snapshot,
            item: spareMag,
            location: "inventory",
            actionScope: "inUse"
        });

        expect(rows.map((row) => row.id)).toEqual(["use", "drop", "loadInto"]);
        expect(rows.find((row) => row.id === "loadInto")?.action).toEqual({
            type: "load",
            receiverId: m4.id,
            ammoId: spareMag.id
        });
        expect(rows.find((row) => row.id === "loadInto")?.pendingCostText).toBe(
            "Load M16x30 — 8 APts"
        );
    });

    it("offers Load on a ground magazine compatible with the in-use weapon", () => {
        const snapshot = makeSnapshot({
            items: [m4],
            inUseItemId: m4.id,
            groundItems: [spareMag]
        });
        const rows = getItemMenu({
            snapshot,
            item: spareMag,
            location: "ground",
            actionScope: "inUse"
        });

        expect(rows.map((row) => row.id)).toEqual(["pickup", "pickupAndUse", "loadInto"]);
        expect(rows.find((row) => row.id === "loadInto")?.action).toEqual({
            type: "load",
            receiverId: m4.id,
            ammoId: spareMag.id
        });
        expect(rows.find((row) => row.id === "loadInto")?.cost).toBe(16);
    });

    it("does not add unuse to Use cost when nothing is equipped", () => {
        const snapshot = makeSnapshot({ items: [coffee] });
        expect(getUseCost(snapshot)).toBe(8);

        const rows = getItemMenu({
            snapshot,
            item: coffee,
            location: "inventory",
            actionScope: "inUse"
        });
        expect(rows[0]?.cost).toBe(8);
    });

    it("offers Put away, Drop, Load, and Unload for the in-use item", () => {
        const snapshot = makeSnapshot({
            items: [m4, spareMag],
            inUseItemId: m4.id
        });
        const rows = getItemMenu({
            snapshot,
            item: m4,
            location: "inUse",
            actionScope: "inUse"
        });

        expect(rows.map((row) => row.id)).toEqual(["unuse", "drop", "load", "unload"]);
        expect(
            rows.find((row) => row.id === "load")?.children?.map((child) => child.action)
        ).toEqual([{ type: "load", receiverId: m4.id, ammoId: spareMag.id }]);
        expect(rows.find((row) => row.id === "load")?.children?.[0]?.cost).toBe(8);
    });

    it("omits Unload when the ammo slot is empty", () => {
        const emptyM4 = makeItem({
            ...m4,
            slots: [{ ...m4.slots[0]!, contents: null }]
        });
        const snapshot = makeSnapshot({ items: [emptyM4, spareMag], inUseItemId: emptyM4.id });
        const rows = getItemMenu({
            snapshot,
            item: emptyM4,
            location: "inUse",
            actionScope: "inUse"
        });

        expect(rows.map((row) => row.id)).toEqual(["unuse", "drop", "load"]);
    });

    it("offers Load/Unload for a slot inside the in-use item", () => {
        const snapshot = makeSnapshot({
            items: [m4],
            inUseItemId: m4.id,
            groundItems: [
                makeItem({
                    id: "5.56mm-nato.round-9",
                    type: "round",
                    shortName: "5.56"
                })
            ]
        });
        const rows = getItemMenu({
            snapshot,
            item: magInPack,
            location: "slot",
            actionScope: "inUse"
        });

        expect(rows.map((row) => row.id)).toEqual(["load", "unload", "drop"]);
        expect(rows[0]?.children?.[0]?.action).toEqual({
            type: "load",
            receiverId: magInPack.id,
            ammoId: "5.56mm-nato.round-9"
        });
        expect(rows[0]?.children?.[0]?.cost).toBe(16);
        expect(rows[0]?.children?.[0]?.pendingCostText).toBe("Load 5.56 — 16 APts");
        expect(rows.find((row) => row.id === "drop")?.action).toEqual({
            type: "drop",
            itemId: "5.56mm-nato.round-1"
        });
        expect(rows.find((row) => row.id === "drop")?.cost).toBe(12);
    });

    it("offers Load/Unload on the slot owner for a gun ammo well", () => {
        const snapshot = makeSnapshot({
            items: [m4, spareMag],
            inUseItemId: m4.id
        });
        const rows = getItemMenu({
            snapshot,
            item: m4,
            location: "slot",
            actionScope: "inUse",
            emptySlot: false
        });

        expect(rows.map((row) => row.id)).toEqual(["load", "unload", "drop"]);
        expect(rows.find((row) => row.id === "unload")?.action).toEqual({
            type: "unload",
            itemId: m4.id
        });
        expect(rows.find((row) => row.id === "drop")?.action).toEqual({
            type: "drop",
            itemId: magInPack.id
        });
        expect(
            rows.find((row) => row.id === "load")?.children?.map((child) => child.action)
        ).toEqual([{ type: "load", receiverId: m4.id, ammoId: spareMag.id }]);
    });

    it("offers only Load for an empty slot on the in-use item", () => {
        const emptyM4 = makeItem({
            ...m4,
            slots: [{ ...m4.slots[0]!, contents: null }]
        });
        const snapshot = makeSnapshot({ items: [emptyM4, spareMag], inUseItemId: emptyM4.id });
        const rows = getItemMenu({
            snapshot,
            item: emptyM4,
            location: "slot",
            actionScope: "inUse",
            emptySlot: true
        });

        expect(rows.map((row) => row.id)).toEqual(["load"]);
        expect(rows[0]?.children?.[0]?.action).toEqual({
            type: "load",
            receiverId: emptyM4.id,
            ammoId: spareMag.id
        });
    });

    it("returns no slot actions for a nested item outside the in-use tree", () => {
        const otherGun = makeItem({
            id: "spas-12.gun-1",
            type: "gun",
            shortName: "SPAS",
            slots: [
                {
                    slot: "ammo",
                    compatibleIds: ["12-guage-buckshot.round"],
                    maxQuantity: 8,
                    contents: makeItem({
                        id: "12-guage-buckshot.round-1",
                        type: "round",
                        shortName: "Buck"
                    })
                }
            ]
        });
        const snapshot = makeSnapshot({ items: [m4, otherGun], inUseItemId: m4.id });
        const rows = getItemMenu({
            snapshot,
            item: otherGun.slots[0]!.contents!,
            location: "slot",
            actionScope: "inUse"
        });

        expect(rows).toEqual([]);
    });

    it("offers Pickup and Pickup and use for ground items", () => {
        const snapshot = makeSnapshot({ items: [m4], inUseItemId: m4.id, groundItems: [coffee] });
        const rows = getItemMenu({
            snapshot,
            item: coffee,
            location: "ground",
            actionScope: "inUse"
        });

        expect(rows.map((row) => row.id)).toEqual(["pickup", "pickupAndUse"]);
        expect(rows[1]?.action).toEqual({ type: "pickup", itemId: coffee.id, use: true });
    });

    it("enables drop/load/unload on backpack items when actionScope is all", () => {
        const snapshot = makeSnapshot({ items: [m4, spareMag] });
        const rows = getItemMenu({
            snapshot,
            item: m4,
            location: "inventory",
            actionScope: "all"
        });

        expect(rows.map((row) => row.id)).toEqual(["use", "drop", "load", "unload"]);
    });

    it("only lists compatible ammo from inventory and ground", () => {
        const wrongMag = makeItem({
            id: "40mm-he.round-1",
            type: "round",
            shortName: "40mm HE"
        });
        const groundMag = makeItem({
            id: "m16-30.magazine-8",
            type: "magazine",
            shortName: "M16x30"
        });
        const snapshot = makeSnapshot({
            items: [m4, spareMag, wrongMag],
            inUseItemId: m4.id,
            groundItems: [groundMag, coffee]
        });

        const ammo = findCompatibleAmmo(snapshot, m4);
        expect(ammo.map(({ item, fromGround }) => [item.id, fromGround])).toEqual([
            [spareMag.id, false],
            [groundMag.id, true]
        ]);
    });

    it("disables unaffordable rows", () => {
        const snapshot = makeSnapshot({
            items: [m4, spareMag],
            inUseItemId: m4.id,
            actionPoints: { value: 3, max: 47 }
        });
        const inUseRows = getItemMenu({
            snapshot,
            item: m4,
            location: "inUse",
            actionScope: "inUse"
        });
        expect(inUseRows.every((row) => row.disabled)).toBe(true);

        const groundRows = getItemMenu({
            snapshot,
            item: coffee,
            location: "ground",
            actionScope: "inUse"
        });
        expect(groundRows.every((row) => row.disabled)).toBe(true);

        const backpackRows = getItemMenu({
            snapshot: makeSnapshot({
                items: [coffee],
                actionPoints: { value: 5, max: 47 }
            }),
            item: coffee,
            location: "inventory",
            actionScope: "inUse"
        });
        expect(backpackRows[0]?.disabled).toBe(true);
        expect(backpackRows[0]?.pendingCostText).toBe("Use Coffee — 8 APts");
    });

    it("disables Load when every compatible ammo is unaffordable", () => {
        const snapshot = makeSnapshot({
            items: [m4],
            inUseItemId: m4.id,
            groundItems: [spareMag],
            actionPoints: { value: 10, max: 47 }
        });
        const rows = getItemMenu({
            snapshot,
            item: m4,
            location: "inUse",
            actionScope: "inUse"
        });
        const load = rows.find((row) => row.id === "load");
        expect(load?.children?.[0]?.cost).toBe(16);
        expect(load?.children?.[0]?.disabled).toBe(true);
        expect(load?.disabled).toBe(true);
    });
});

describe("collectAmmoCounts", () => {
    it("reports magazine round count from the ammo slot", () => {
        expect(collectAmmoCounts(magInPack).map(formatAmmoCount)).toEqual(["30/30"]);
        expect(collectAmmoCounts(spareMag).map(formatAmmoCount)).toEqual(["0/30"]);
    });

    it("reports a magazine-fed gun as a single count, not a nested duplicate", () => {
        expect(collectAmmoCounts(m4).map(formatAmmoCount)).toEqual(["30/30"]);
    });

    it("reports 0/max for an empty ammo well", () => {
        const emptyM4 = makeItem({
            ...m4,
            slots: [{ ...m4.slots[0]!, contents: null }]
        });
        expect(collectAmmoCounts(emptyM4).map(formatAmmoCount)).toEqual(["0/1"]);
    });

    it("collects one count per nested ammo slot on a combo item", () => {
        expect(collectAmmoCounts(combo).map(formatAmmoCount)).toEqual(["30/30", "1/1"]);
    });

    it("returns no counts for items without ammo slots", () => {
        expect(collectAmmoCounts(coffee)).toEqual([]);
    });
});

describe("describeItemContents", () => {
    it("says what a magazine is loaded with", () => {
        expect(describeItemContents(magInPack)).toEqual([{ depth: 0, text: "Ammo: 5.56 ×30/30" }]);
    });

    it("says an empty well is empty", () => {
        expect(describeItemContents(spareMag)).toEqual([{ depth: 0, text: "Ammo: empty" }]);
    });

    it("descends from a gun through its magazine to the rounds", () => {
        expect(describeItemContents(m4)).toEqual([
            { depth: 0, text: "Ammo: M16x30" },
            { depth: 1, text: "Ammo: 5.56 ×30/30" }
        ]);
    });

    it("names the nested guns of a combo item instead of labelling slots", () => {
        expect(describeItemContents(combo)).toEqual([
            { depth: 0, text: "M4" },
            { depth: 1, text: "Ammo: M16x30" },
            { depth: 2, text: "Ammo: 5.56 ×30/30" },
            { depth: 0, text: "M203" },
            { depth: 1, text: "Ammo: 40mm HE" }
        ]);
    });

    it("returns nothing for an item without slots", () => {
        expect(describeItemContents(coffee)).toEqual([]);
    });
});

describe("collectContentSlots", () => {
    it("returns the gun as owner of a loaded ammo well", () => {
        const refs = collectContentSlots(m4);
        expect(refs).toHaveLength(1);
        expect(refs[0]?.owner.id).toBe(m4.id);
        expect(refs[0]?.slot.slot).toBe("ammo");
        expect(refs[0]?.slot.contents?.id).toBe(magInPack.id);
    });

    it("includes empty wells", () => {
        const emptyM4 = makeItem({
            ...m4,
            slots: [{ ...m4.slots[0]!, contents: null }]
        });
        const refs = collectContentSlots(emptyM4);
        expect(refs).toHaveLength(1);
        expect(refs[0]?.slot.contents).toBeNull();
        expect(refs[0]?.slot.slot).toBe("ammo");
    });

    it("ignores nested item slots 0 and 1 and walks into them", () => {
        const refs = collectContentSlots(combo);
        expect(refs.map((ref) => ref.slot.slot)).toEqual(["ammo", "ammo"]);
        expect(refs.map((ref) => ref.owner.id)).toEqual([m4.id, m203.id]);
        expect(refs.every((ref) => ref.slot.slot !== "0" && ref.slot.slot !== "1")).toBe(true);
    });
});

describe("collectAmmoSlots", () => {
    it("returns the gun as owner of a loaded ammo well", () => {
        const refs = collectAmmoSlots(m4);
        expect(refs).toHaveLength(1);
        expect(refs[0]?.owner.id).toBe(m4.id);
        expect(refs[0]?.slot.slot).toBe("ammo");
        expect(refs[0]?.slot.contents?.id).toBe(magInPack.id);
    });

    it("returns the magazine as owner of its round slot", () => {
        const refs = collectAmmoSlots(magInPack);
        expect(refs).toHaveLength(1);
        expect(refs[0]?.owner.id).toBe(magInPack.id);
        expect(refs[0]?.slot.contents?.id).toBe("5.56mm-nato.round-1");
    });

    it("includes empty ammo wells", () => {
        const emptyM4 = makeItem({
            ...m4,
            slots: [{ ...m4.slots[0]!, contents: null }]
        });
        const refs = collectAmmoSlots(emptyM4);
        expect(refs).toHaveLength(1);
        expect(refs[0]?.owner.id).toBe(emptyM4.id);
        expect(refs[0]?.slot.contents).toBeNull();
    });

    it("flattens nested combo slots to the nested weapons' ammo wells", () => {
        const refs = collectAmmoSlots(combo);
        expect(refs.map((ref) => [ref.owner.id, ref.slot.contents?.id])).toEqual([
            [m4.id, magInPack.id],
            [m203.id, "40mm-he.round-1"]
        ]);
    });

    it("uses nested weapons as empty-slot owners, not the combo parent", () => {
        const emptyM203 = makeItem({
            ...m203,
            slots: [{ ...m203.slots[0]!, contents: null }]
        });
        const emptyCombo = makeItem({
            ...combo,
            slots: [combo.slots[0]!, { ...combo.slots[1]!, contents: emptyM203 }]
        });
        const refs = collectAmmoSlots(emptyCombo);
        expect(refs[1]?.owner.id).toBe(emptyM203.id);
        expect(refs[1]?.owner.id).not.toBe(emptyCombo.id);
        expect(refs[1]?.slot.contents).toBeNull();
    });

    it("returns no slots for items without ammo", () => {
        expect(collectAmmoSlots(coffee)).toEqual([]);
    });
});

describe("resolveInventoryDrag", () => {
    const snapshot = makeSnapshot({
        items: [m4, spareMag, coffee],
        inUseItemId: m4.id,
        groundItems: [coffee]
    });

    it("uses a backpack item on the in-use zone", () => {
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "inventory", item: coffee },
                target: { type: "inUse" }
            })
        ).toEqual({
            action: { type: "use", itemId: coffee.id },
            pendingCostText: "Use Coffee — 12 APts"
        });
    });

    it("puts the in-use item away on the inventory zone", () => {
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "inUse", item: m4 },
                target: { type: "inventory" }
            })?.action
        ).toEqual({ type: "unuse" });
    });

    it("drops a backpack item on the ground", () => {
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "inventory", item: spareMag },
                target: { type: "ground" }
            })
        ).toEqual({
            action: { type: "drop", itemId: spareMag.id },
            pendingCostText: "Drop M16x30 — 8 APts"
        });
    });

    it("picks up a ground item, or picks up and uses it on the in-use zone", () => {
        const groundCoffee = coffee;
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "ground", item: groundCoffee },
                target: { type: "inventory" }
            })?.action
        ).toEqual({ type: "pickup", itemId: groundCoffee.id });
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "ground", item: groundCoffee },
                target: { type: "inUse" }
            })?.action
        ).toEqual({ type: "pickup", itemId: groundCoffee.id, use: true });
    });

    it("loads compatible ammo onto an in-use content slot", () => {
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "inventory", item: spareMag },
                target: { type: "slot", owner: m4 }
            })?.action
        ).toEqual({ type: "load", receiverId: m4.id, ammoId: spareMag.id });
    });

    it("unloads a content slot onto inventory, or unloads and drops onto the ground", () => {
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "slot", owner: m4, item: magInPack },
                target: { type: "inventory" }
            })
        ).toEqual({
            action: { type: "unload", itemId: m4.id },
            pendingCostText: "Unload M16x30 — 8 APts"
        });
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "slot", owner: m4, item: magInPack },
                target: { type: "ground" }
            })
        ).toEqual({
            action: { type: "drop", itemId: magInPack.id },
            pendingCostText: "Unload and drop M16x30 — 12 APts"
        });
    });

    it("ignores incompatible, unaffordable, and no-op drops", () => {
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "inventory", item: coffee },
                target: { type: "slot", owner: m4 }
            })
        ).toBeNull();
        expect(
            resolveInventoryDrag({
                snapshot,
                actionScope: "inUse",
                source: { type: "inventory", item: m4 },
                target: { type: "inUse" }
            })
        ).toBeNull();
        expect(
            resolveInventoryDrag({
                snapshot: makeSnapshot({
                    items: [m4, spareMag],
                    inUseItemId: m4.id,
                    actionPoints: { value: 3, max: 47 }
                }),
                actionScope: "inUse",
                source: { type: "inventory", item: spareMag },
                target: { type: "ground" }
            })
        ).toBeNull();
    });
});

describe("resolveItemMenuTarget", () => {
    it("resolves backpack, in-use, ground, and content-slot owners", () => {
        const snapshot = makeSnapshot({
            items: [m4, coffee],
            inUseItemId: m4.id,
            groundItems: [spareMag]
        });

        expect(resolveItemMenuTarget(snapshot, coffee.id)).toEqual({
            item: coffee,
            location: "inventory",
            emptySlot: false
        });
        expect(resolveItemMenuTarget(snapshot, m4.id)).toEqual({
            item: m4,
            location: "inUse",
            emptySlot: false
        });
        expect(resolveItemMenuTarget(snapshot, spareMag.id)).toEqual({
            item: spareMag,
            location: "ground",
            emptySlot: false
        });
        expect(resolveItemMenuTarget(snapshot, magInPack.id)).toEqual({
            item: m4,
            location: "slot",
            emptySlot: false
        });
    });
});

describe("findHotkeyAction", () => {
    it("maps U/D/P to use, drop, and pickup for the matching menus", () => {
        const inventoryRows = getItemMenu({
            snapshot: makeSnapshot({ items: [coffee] }),
            item: coffee,
            location: "inventory",
            actionScope: "all"
        });
        expect(findHotkeyAction(inventoryRows, "u")).toEqual({
            type: "use",
            itemId: coffee.id
        });
        expect(findHotkeyAction(inventoryRows, "d")).toEqual({
            type: "drop",
            itemId: coffee.id
        });

        const groundRows = getItemMenu({
            snapshot: makeSnapshot({ items: [m4], inUseItemId: m4.id, groundItems: [coffee] }),
            item: coffee,
            location: "ground",
            actionScope: "inUse"
        });
        expect(findHotkeyAction(groundRows, "p")).toEqual({
            type: "pickup",
            itemId: coffee.id
        });
        expect(findHotkeyAction(groundRows, "u")).toEqual({
            type: "pickup",
            itemId: coffee.id,
            use: true
        });
    });

    it("maps U to unload and D to drop for a filled content slot", () => {
        const snapshot = makeSnapshot({ items: [m4, spareMag], inUseItemId: m4.id });
        const rows = getItemMenu({
            snapshot,
            item: m4,
            location: "slot",
            actionScope: "inUse"
        });

        expect(findHotkeyAction(rows, "u")).toEqual({ type: "unload", itemId: m4.id });
        expect(findHotkeyAction(rows, "d")).toEqual({ type: "drop", itemId: magInPack.id });
    });

    it("maps P to put away for the in-use item", () => {
        const rows = getItemMenu({
            snapshot: makeSnapshot({ items: [m4], inUseItemId: m4.id }),
            item: m4,
            location: "inUse",
            actionScope: "inUse"
        });

        expect(findHotkeyAction(rows, "p")).toEqual({ type: "unuse" });
    });
});
