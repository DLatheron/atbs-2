import type {
    InventoryItemView,
    InventorySnapshot,
    InventorySlotType,
    ItemId
} from "@atbs/shared-data";

export type ItemMenuLocation = "inUse" | "inventory" | "ground" | "slot";
export type InventoryActionScope = "inUse" | "all";
export type InventoryMode = "action" | "shop";
/** What the inspector panel shows. `"inUse"` stays on the equipped item; `"selected"` follows clicks. */
export type InventoryInspectorFocus = "inUse" | "selected";

export type ItemMenuAction =
    | { type: "use"; itemId: ItemId }
    | { type: "unuse" }
    | { type: "drop"; itemId: ItemId }
    | { type: "pickup"; itemId: ItemId; use?: boolean }
    | { type: "load"; receiverId: ItemId; ammoId: ItemId }
    | { type: "unload"; itemId: ItemId };

export interface ItemMenuRow {
    id: string;
    label: string;
    cost: number;
    disabled: boolean;
    action: ItemMenuAction | null;
    pendingCostText: string | null;
    children?: ItemMenuRow[];
}

export interface GetItemMenuArgs {
    snapshot: InventorySnapshot;
    item: InventoryItemView;
    location: ItemMenuLocation;
    actionScope: InventoryActionScope;
    /**
     * When true, `item` is the slot owner (parent) and the ammo/weapon slot is empty.
     * Only Load is offered.
     */
    emptySlot?: boolean;
}

/**
 * Instance ids are `{recipeId}-{instanceIndex}` (e.g. `m16-30.magazine-1`).
 * Slot `compatibleIds` are recipe ids (e.g. `m16-30.magazine`).
 */
export function matchesCompatibleId(itemId: ItemId, compatibleId: ItemId): boolean {
    return itemId === compatibleId || itemId.startsWith(`${compatibleId}-`);
}

export function getAmmoSlot(item: InventoryItemView) {
    return item.slots.find((slot: InventoryItemView["slots"][number]) => slot.slot === "ammo");
}

export function findItemInTree(item: InventoryItemView, id: ItemId): InventoryItemView | null {
    if (item.id === id) {
        return item;
    }

    for (const slot of item.slots) {
        if (slot.contents) {
            const found = findItemInTree(slot.contents, id);
            if (found) {
                return found;
            }
        }
    }

    return null;
}

export function findItemInSnapshot(
    snapshot: InventorySnapshot,
    id: ItemId
): InventoryItemView | null {
    for (const item of snapshot.items) {
        const found = findItemInTree(item, id);
        if (found) {
            return found;
        }
    }

    for (const item of snapshot.groundItems) {
        const found = findItemInTree(item, id);
        if (found) {
            return found;
        }
    }

    return null;
}

export function getInUseItem(snapshot: InventorySnapshot): InventoryItemView | null {
    if (!snapshot.inUseItemId) {
        return null;
    }

    return (
        snapshot.items.find((item: InventoryItemView) => item.id === snapshot.inUseItemId) ?? null
    );
}

export function isInUseTree(snapshot: InventorySnapshot, itemId: ItemId): boolean {
    const inUse = getInUseItem(snapshot);
    if (!inUse) {
        return false;
    }

    return findItemInTree(inUse, itemId) !== null;
}

export function formatPendingCost(label: string, name: string, cost: number): string {
    return `${label} ${name} — ${cost} APts`;
}

/** Use costs unuse+use when something is already equipped (switch). */
export function getUseCost(snapshot: InventorySnapshot): number {
    const { costs, inUseItemId } = snapshot;
    return inUseItemId ? costs.use + costs.unuse : costs.use;
}

export function findCompatibleAmmo(
    snapshot: InventorySnapshot,
    receiver: InventoryItemView
): Array<{ item: InventoryItemView; fromGround: boolean }> {
    const ammoSlot = getAmmoSlot(receiver);
    if (!ammoSlot || ammoSlot.compatibleIds.length === 0) {
        return [];
    }

    const matches = (item: InventoryItemView) =>
        ammoSlot.compatibleIds.some((compatibleId: ItemId) =>
            matchesCompatibleId(item.id, compatibleId)
        );

    const fromInventory = snapshot.items
        .filter((item: InventoryItemView) => item.id !== receiver.id && matches(item))
        .map((item: InventoryItemView) => ({ item, fromGround: false }));

    const fromGround = snapshot.groundItems
        .filter((item: InventoryItemView) => matches(item))
        .map((item: InventoryItemView) => ({ item, fromGround: true }));

    return [...fromInventory, ...fromGround];
}

function unaffordable(snapshot: InventorySnapshot, cost: number): boolean {
    return snapshot.actionPoints.value < cost;
}

function buildLoadRow(snapshot: InventorySnapshot, receiver: InventoryItemView): ItemMenuRow {
    const ammo = findCompatibleAmmo(snapshot, receiver);
    const children: ItemMenuRow[] = ammo.map(({ item, fromGround }) => {
        const cost = fromGround ? snapshot.costs.loadFromGround : snapshot.costs.load;

        return {
            id: `load-${item.id}`,
            label: item.shortName,
            cost,
            disabled: unaffordable(snapshot, cost),
            action: { type: "load", receiverId: receiver.id, ammoId: item.id },
            pendingCostText: formatPendingCost("Load", item.shortName, cost)
        };
    });

    const hasAffordableChild = children.some((child) => !child.disabled);

    return {
        id: "load",
        label: "Load",
        cost: snapshot.costs.load,
        disabled: children.length === 0 || !hasAffordableChild,
        action: null,
        pendingCostText: null,
        children
    };
}

function buildUnloadRow(snapshot: InventorySnapshot, item: InventoryItemView): ItemMenuRow | null {
    const ammoSlot = getAmmoSlot(item);
    if (!ammoSlot?.contents) {
        return null;
    }

    const cost = snapshot.costs.unload;

    return {
        id: "unload",
        label: "Unload",
        cost,
        disabled: unaffordable(snapshot, cost),
        action: { type: "unload", itemId: item.id },
        pendingCostText: formatPendingCost("Unload", item.shortName, cost)
    };
}

/**
 * Load this ammo/magazine into a compatible well on the in-use item (and nested guns).
 */
function buildLoadIntoInUseRow(
    snapshot: InventorySnapshot,
    ammo: InventoryItemView,
    fromGround: boolean,
    label = "Load"
): ItemMenuRow | null {
    const inUse = getInUseItem(snapshot);
    if (!inUse || ammo.id === inUse.id) {
        return null;
    }

    const receivers = collectAmmoSlots(inUse)
        .map(({ owner }) => owner)
        .filter((owner, index, all) => all.findIndex((entry) => entry.id === owner.id) === index)
        .filter((owner) => canLoadIntoSlot(owner, ammo));

    if (receivers.length === 0) {
        return null;
    }

    const cost = fromGround ? snapshot.costs.loadFromGround : snapshot.costs.load;
    const children: ItemMenuRow[] = receivers.map((receiver) => ({
        id: `load-into-${receiver.id}`,
        label: receiver.shortName,
        cost,
        disabled: unaffordable(snapshot, cost),
        action: { type: "load", receiverId: receiver.id, ammoId: ammo.id },
        pendingCostText: formatPendingCost("Load", ammo.shortName, cost)
    }));

    if (children.length === 1) {
        const only = children[0]!;
        return {
            id: "loadInto",
            label,
            cost: only.cost,
            disabled: only.disabled,
            action: only.action,
            pendingCostText: only.pendingCostText
        };
    }

    const hasAffordableChild = children.some((child) => !child.disabled);

    return {
        id: "loadInto",
        label,
        cost,
        disabled: !hasAffordableChild,
        action: null,
        pendingCostText: null,
        children
    };
}

function buildLoadUnloadRows(
    snapshot: InventorySnapshot,
    item: InventoryItemView,
    emptySlot: boolean
): ItemMenuRow[] {
    const ammoSlot = getAmmoSlot(item);
    if (!ammoSlot) {
        return [];
    }

    const rows: ItemMenuRow[] = [buildLoadRow(snapshot, item)];
    if (!emptySlot) {
        const unload = buildUnloadRow(snapshot, item);
        if (unload) {
            rows.push(unload);
        }
    }

    return rows;
}

function row(
    id: string,
    label: string,
    cost: number,
    snapshot: InventorySnapshot,
    action: ItemMenuAction,
    name: string
): ItemMenuRow {
    return {
        id,
        label,
        cost,
        disabled: unaffordable(snapshot, cost),
        action,
        pendingCostText: formatPendingCost(label, name, cost)
    };
}

export function getItemMenu({
    snapshot,
    item,
    location,
    actionScope,
    emptySlot = false
}: GetItemMenuArgs): ItemMenuRow[] {
    switch (location) {
        case "inventory": {
            const rows: ItemMenuRow[] = [
                row(
                    "use",
                    "Use",
                    getUseCost(snapshot),
                    snapshot,
                    { type: "use", itemId: item.id },
                    item.shortName
                )
            ];

            if (actionScope === "all") {
                rows.push(
                    row(
                        "drop",
                        "Drop",
                        snapshot.costs.drop,
                        snapshot,
                        { type: "drop", itemId: item.id },
                        item.shortName
                    )
                );
                rows.push(...buildLoadUnloadRows(snapshot, item, false));
            }

            const loadIntoLabel = rows.some((entry) => entry.id === "load")
                ? "Load into weapon"
                : "Load";
            const loadIntoInUse = buildLoadIntoInUseRow(snapshot, item, false, loadIntoLabel);
            if (loadIntoInUse) {
                rows.push(loadIntoInUse);
            }

            return rows;
        }

        case "inUse": {
            return [
                row(
                    "unuse",
                    "Put away",
                    snapshot.costs.unuse,
                    snapshot,
                    { type: "unuse" },
                    item.shortName
                ),
                row(
                    "drop",
                    "Drop",
                    snapshot.costs.drop,
                    snapshot,
                    { type: "drop", itemId: item.id },
                    item.shortName
                ),
                ...buildLoadUnloadRows(snapshot, item, false)
            ];
        }

        case "ground": {
            const rows: ItemMenuRow[] = [
                row(
                    "pickup",
                    "Pickup",
                    snapshot.costs.pickup,
                    snapshot,
                    { type: "pickup", itemId: item.id },
                    item.shortName
                ),
                row(
                    "pickupAndUse",
                    "Pickup and use",
                    snapshot.costs.pickupAndUse,
                    snapshot,
                    { type: "pickup", itemId: item.id, use: true },
                    item.shortName
                )
            ];

            const loadIntoInUse = buildLoadIntoInUseRow(snapshot, item, true);
            if (loadIntoInUse) {
                rows.push(loadIntoInUse);
            }

            return rows;
        }

        case "slot": {
            const allowed = actionScope === "all" || isInUseTree(snapshot, item.id);
            if (!allowed) {
                return [];
            }

            return buildLoadUnloadRows(snapshot, item, emptySlot);
        }
    }
}

/** Combo parents nest real items under these; they are walked, never shown as content tiles. */
const NESTED_ITEM_SLOT_TYPES: ReadonlySet<InventorySlotType> = new Set(["0", "1"]);

export function isNestedItemSlot(slot: InventorySlotType): boolean {
    return NESTED_ITEM_SLOT_TYPES.has(slot);
}

export function slotLabel(slot: InventorySlotType): string {
    switch (slot) {
        case "ammo":
            return "Ammo";
        case "0":
            return "Slot 0";
        case "1":
            return "Slot 1";
    }
}

export interface AmmoCount {
    current: number;
    max: number;
}

export type InventorySlotView = InventoryItemView["slots"][number];

/** A displayed content slot plus the item that owns it (not a combo parent). */
export interface ContentSlotRef {
    owner: InventoryItemView;
    slot: InventorySlotView;
}

export type AmmoSlotRef = ContentSlotRef;

export function formatAmmoCount(count: AmmoCount): string {
    return `${count.current}/${count.max}`;
}

function ammoCountFromSlot(slot: InventorySlotView): AmmoCount {
    const contents = slot.contents;
    if (!contents) {
        return { current: 0, max: slot.maxQuantity };
    }

    const nestedAmmo = getAmmoSlot(contents);
    if (nestedAmmo) {
        return {
            current: nestedAmmo.contents?.quantity ?? 0,
            max: nestedAmmo.maxQuantity
        };
    }

    return { current: contents.quantity, max: slot.maxQuantity };
}

/**
 * Recursively collect content slots for the inspector. Combo items (e.g. M4+M203)
 * nest guns under `"0"` / `"1"`; those are walked, not presented. Empty wells are
 * included. Does not descend into a displayed slot's contents (a loaded magazine
 * is one tile, not two).
 */
export function collectContentSlots(item: InventoryItemView): ContentSlotRef[] {
    const refs: ContentSlotRef[] = [];

    const walk = (node: InventoryItemView) => {
        for (const slot of node.slots) {
            if (isNestedItemSlot(slot.slot)) {
                if (slot.contents) {
                    walk(slot.contents);
                }
                continue;
            }

            refs.push({ owner: node, slot });
        }
    };

    walk(item);
    return refs;
}

/** Ammo wells only — used for tile counts. Same walk rules as {@link collectContentSlots}. */
export function collectAmmoSlots(item: InventoryItemView): ContentSlotRef[] {
    return collectContentSlots(item).filter(({ slot }) => slot.slot === "ammo");
}

/**
 * Recursively collect ammo-bearing slots. Combo items (e.g. M4+M203) expose
 * nested guns under `"0"` / `"1"`; each gun's `"ammo"` slot yields one count.
 * Magazine-fed guns report the magazine's round count, not a second nested count.
 */
export function collectAmmoCounts(item: InventoryItemView): AmmoCount[] {
    return collectAmmoSlots(item).map(({ slot }) => ammoCountFromSlot(slot));
}

export type InventoryDragSource =
    | { type: "inventory"; item: InventoryItemView }
    | { type: "inUse"; item: InventoryItemView }
    | { type: "ground"; item: InventoryItemView }
    | { type: "slot"; owner: InventoryItemView; item: InventoryItemView };

export type InventoryDragTarget =
    | { type: "inUse" }
    | { type: "inventory"; overItemId?: ItemId }
    | { type: "ground" }
    | { type: "slot"; owner: InventoryItemView };

export interface InventoryDragResult {
    action: ItemMenuAction;
    pendingCostText: string;
}

function canAfford(snapshot: InventorySnapshot, cost: number): boolean {
    return !unaffordable(snapshot, cost);
}

export function canLoadIntoSlot(owner: InventoryItemView, ammo: InventoryItemView): boolean {
    if (owner.id === ammo.id) {
        return false;
    }

    const slot = getAmmoSlot(owner);
    if (!slot || slot.contents?.id === ammo.id) {
        return false;
    }

    return slot.compatibleIds.some((compatibleId: ItemId) =>
        matchesCompatibleId(ammo.id, compatibleId)
    );
}

function slotActionsAllowed(
    snapshot: InventorySnapshot,
    actionScope: InventoryActionScope,
    owner: InventoryItemView
): boolean {
    return actionScope === "all" || isInUseTree(snapshot, owner.id);
}

function loadResult(
    snapshot: InventorySnapshot,
    owner: InventoryItemView,
    ammo: InventoryItemView,
    fromGround: boolean
): InventoryDragResult | null {
    if (!canLoadIntoSlot(owner, ammo)) {
        return null;
    }

    const cost = fromGround ? snapshot.costs.loadFromGround : snapshot.costs.load;
    if (!canAfford(snapshot, cost)) {
        return null;
    }

    return {
        action: { type: "load", receiverId: owner.id, ammoId: ammo.id },
        pendingCostText: formatPendingCost("Load", ammo.shortName, cost)
    };
}

export function resolveInventoryDrag({
    snapshot,
    actionScope,
    source,
    target
}: {
    snapshot: InventorySnapshot;
    actionScope: InventoryActionScope;
    source: InventoryDragSource;
    target: InventoryDragTarget;
}): InventoryDragResult | null {
    switch (source.type) {
        case "inventory": {
            switch (target.type) {
                case "inUse": {
                    if (source.item.id === snapshot.inUseItemId) {
                        return null;
                    }
                    const cost = getUseCost(snapshot);
                    if (!canAfford(snapshot, cost)) {
                        return null;
                    }
                    return {
                        action: { type: "use", itemId: source.item.id },
                        pendingCostText: formatPendingCost("Use", source.item.shortName, cost)
                    };
                }
                case "ground": {
                    const cost = snapshot.costs.drop;
                    if (!canAfford(snapshot, cost)) {
                        return null;
                    }
                    return {
                        action: { type: "drop", itemId: source.item.id },
                        pendingCostText: formatPendingCost("Drop", source.item.shortName, cost)
                    };
                }
                case "slot": {
                    if (!slotActionsAllowed(snapshot, actionScope, target.owner)) {
                        return null;
                    }
                    return loadResult(snapshot, target.owner, source.item, false);
                }
                case "inventory":
                    return null;
            }
            break;
        }
        case "inUse": {
            switch (target.type) {
                case "inventory": {
                    const cost = snapshot.costs.unuse;
                    if (!canAfford(snapshot, cost)) {
                        return null;
                    }
                    return {
                        action: { type: "unuse" },
                        pendingCostText: formatPendingCost("Put away", source.item.shortName, cost)
                    };
                }
                case "ground": {
                    const cost = snapshot.costs.drop;
                    if (!canAfford(snapshot, cost)) {
                        return null;
                    }
                    return {
                        action: { type: "drop", itemId: source.item.id },
                        pendingCostText: formatPendingCost("Drop", source.item.shortName, cost)
                    };
                }
                case "slot": {
                    if (!slotActionsAllowed(snapshot, actionScope, target.owner)) {
                        return null;
                    }
                    return loadResult(snapshot, target.owner, source.item, false);
                }
                case "inUse":
                    return null;
            }
            break;
        }
        case "ground": {
            switch (target.type) {
                case "inventory": {
                    const cost = snapshot.costs.pickup;
                    if (!canAfford(snapshot, cost)) {
                        return null;
                    }
                    return {
                        action: { type: "pickup", itemId: source.item.id },
                        pendingCostText: formatPendingCost("Pickup", source.item.shortName, cost)
                    };
                }
                case "inUse": {
                    const cost = snapshot.costs.pickupAndUse;
                    if (!canAfford(snapshot, cost)) {
                        return null;
                    }
                    return {
                        action: { type: "pickup", itemId: source.item.id, use: true },
                        pendingCostText: formatPendingCost(
                            "Pickup and use",
                            source.item.shortName,
                            cost
                        )
                    };
                }
                case "slot": {
                    if (!slotActionsAllowed(snapshot, actionScope, target.owner)) {
                        return null;
                    }
                    return loadResult(snapshot, target.owner, source.item, true);
                }
                case "ground":
                    return null;
            }
            break;
        }
        case "slot": {
            if (!slotActionsAllowed(snapshot, actionScope, source.owner)) {
                return null;
            }
            switch (target.type) {
                case "inventory": {
                    const cost = snapshot.costs.unload;
                    if (!canAfford(snapshot, cost)) {
                        return null;
                    }
                    return {
                        action: { type: "unload", itemId: source.owner.id },
                        pendingCostText: formatPendingCost("Unload", source.item.shortName, cost)
                    };
                }
                case "ground": {
                    const cost = snapshot.costs.unload + snapshot.costs.drop;
                    if (!canAfford(snapshot, cost)) {
                        return null;
                    }
                    return {
                        action: { type: "drop", itemId: source.item.id },
                        pendingCostText: formatPendingCost(
                            "Unload and drop",
                            source.item.shortName,
                            cost
                        )
                    };
                }
                case "inUse":
                case "slot":
                    return null;
            }
        }
    }

    return null;
}
