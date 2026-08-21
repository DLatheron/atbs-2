import { DEFAULT_CURRENCY } from "@atbs/shared-data";
import type {
    InventoryItemView,
    InventorySnapshot,
    InventorySlotType,
    ItemId,
    StoreItemView,
    StoreSnapshot
} from "@atbs/shared-data";

export type ItemMenuLocation = "inUse" | "inventory" | "ground" | "slot" | "store";
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
    | { type: "unload"; itemId: ItemId }
    | { type: "buy"; itemId: ItemId; use?: boolean }
    | { type: "sell"; itemId: ItemId; quantity: number };

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
    mode?: InventoryMode;
    store?: StoreSnapshot | null;
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
    id: ItemId,
    store?: StoreSnapshot | null
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

    if (store) {
        for (const storeItem of store.items) {
            const found = findItemInTree(storeItem.item, id);
            if (found) {
                return found;
            }
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

export function formatPendingMoney(
    label: string,
    name: string,
    cost: number,
    currency: string = DEFAULT_CURRENCY
): string {
    return cost === 0 ? `${label} ${name}` : `${label} ${name} — ${formatMoney(cost, currency)}`;
}

/** Shop prices are only worth showing when something is actually charged. */
export function formatMoney(cost: number, currency: string = DEFAULT_CURRENCY): string {
    return cost === 0 ? "Free" : `${currency}${cost.toFixed(0)}`;
}

export function storeBatchQuantity(store: StoreSnapshot, itemId: ItemId): number {
    const storeItem = store.items.find((entry: StoreItemView) => entry.itemId === itemId);
    if (!storeItem) {
        return 0;
    }
    return Math.min(storeItem.batchSize, storeItem.item.quantity);
}

export function storeBatchCost(store: StoreSnapshot, itemId: ItemId): number {
    const storeItem = store.items.find((entry: StoreItemView) => entry.itemId === itemId);
    if (!storeItem) {
        return 0;
    }
    const quantity = storeBatchQuantity(store, itemId);
    return (storeItem.cost * quantity) / storeItem.batchSize;
}

export function canAffordStore(store: StoreSnapshot, cost: number): boolean {
    return store.budget - cost >= store.threshold;
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

/** Drop cost for an inventory item: cheaper when it is already in use. */
export function getDropCost(snapshot: InventorySnapshot, itemId: ItemId): number {
    return snapshot.inUseItemId === itemId ? snapshot.costs.drop : snapshot.costs.dropFromInventory;
}

function moneyRow(
    id: string,
    label: string,
    cost: number,
    store: StoreSnapshot,
    action: ItemMenuAction,
    name: string,
    disabled = false
): ItemMenuRow {
    return {
        id,
        label,
        cost,
        disabled: disabled || !canAffordStore(store, cost),
        action,
        pendingCostText: formatPendingMoney(label, name, cost, store.currency)
    };
}

export function findStoreItemId(store: StoreSnapshot, item: InventoryItemView): ItemId | null {
    return store.items.find((entry: StoreItemView) => entry.item.id === item.id)?.itemId ?? null;
}

function getShopItemMenu({
    snapshot,
    item,
    location,
    emptySlot,
    store
}: {
    snapshot: InventorySnapshot;
    item: InventoryItemView;
    location: ItemMenuLocation;
    emptySlot: boolean;
    store: StoreSnapshot | null;
}): ItemMenuRow[] {
    if (!store) {
        return [];
    }

    switch (location) {
        case "store": {
            const itemId = findStoreItemId(store, item);
            if (!itemId) {
                return [];
            }
            const cost = storeBatchCost(store, itemId);
            const soldOut = storeBatchQuantity(store, itemId) <= 0;
            const rows: ItemMenuRow[] = [
                moneyRow(
                    "buy",
                    "Buy",
                    cost,
                    store,
                    { type: "buy", itemId },
                    item.shortName,
                    soldOut
                )
            ];
            if (item.type === "gun" || item.type === "item" || item.type === "grenade") {
                rows.push(
                    moneyRow(
                        "buyAndUse",
                        "Buy and use",
                        cost,
                        store,
                        { type: "buy", itemId, use: true },
                        item.shortName,
                        soldOut
                    )
                );
            }
            return rows;
        }
        case "inventory": {
            const rows: ItemMenuRow[] = [
                moneyRow("use", "Use", 0, store, { type: "use", itemId: item.id }, item.shortName),
                moneyRow(
                    "sell",
                    "Sell",
                    0,
                    store,
                    { type: "sell", itemId: item.id, quantity: item.quantity },
                    item.shortName
                ),
                ...buildShopLoadUnloadRows(snapshot, item, false, store)
            ];
            return rows;
        }
        case "inUse": {
            return [
                moneyRow("unuse", "Put away", 0, store, { type: "unuse" }, item.shortName),
                moneyRow(
                    "sell",
                    "Sell",
                    0,
                    store,
                    { type: "sell", itemId: item.id, quantity: item.quantity },
                    item.shortName
                ),
                ...buildShopLoadUnloadRows(snapshot, item, false, store)
            ];
        }
        case "slot": {
            const rows = buildShopLoadUnloadRows(snapshot, item, emptySlot, store);
            if (!emptySlot) {
                const contents = getAmmoSlot(item)?.contents;
                if (contents) {
                    rows.push(
                        moneyRow(
                            "sell",
                            "Sell",
                            0,
                            store,
                            { type: "sell", itemId: contents.id, quantity: contents.quantity },
                            contents.shortName
                        )
                    );
                }
            }
            return rows;
        }
        case "ground":
            return [];
    }
}

function buildShopLoadUnloadRows(
    snapshot: InventorySnapshot,
    item: InventoryItemView,
    emptySlot: boolean,
    store: StoreSnapshot
): ItemMenuRow[] {
    const ammoSlot = getAmmoSlot(item);
    if (!ammoSlot) {
        return [];
    }

    const inventoryAmmo = findCompatibleAmmo(snapshot, item);
    const storeAmmo = store.items.filter(
        (entry: StoreItemView) =>
            entry.item.quantity > 0 &&
            ammoSlot.compatibleIds.some((compatibleId: ItemId) =>
                matchesCompatibleId(entry.itemId, compatibleId)
            )
    );

    const children: ItemMenuRow[] = [
        ...inventoryAmmo.map(({ item: ammo }) =>
            moneyRow(
                `load-${ammo.id}`,
                ammo.shortName,
                0,
                store,
                { type: "load", receiverId: item.id, ammoId: ammo.id },
                ammo.shortName
            )
        ),
        ...storeAmmo.map((entry: StoreItemView) => {
            const cost = storeBatchCost(store, entry.itemId);
            return moneyRow(
                `load-store-${entry.itemId}`,
                `${entry.item.shortName} (store)`,
                cost,
                store,
                { type: "load", receiverId: item.id, ammoId: entry.itemId },
                entry.item.shortName
            );
        })
    ];

    const rows: ItemMenuRow[] = [
        {
            id: "load",
            label: "Load",
            cost: 0,
            disabled: children.length === 0,
            action: null,
            pendingCostText: null,
            children
        }
    ];

    if (!emptySlot) {
        const unload = getAmmoSlot(item)?.contents
            ? moneyRow(
                  "unload",
                  "Unload",
                  0,
                  store,
                  { type: "unload", itemId: item.id },
                  item.shortName
              )
            : null;
        if (unload) {
            rows.push(unload);
        }
    }

    return rows;
}

export function getItemMenu({
    snapshot,
    item,
    location,
    actionScope,
    emptySlot = false,
    mode = "action",
    store = null
}: GetItemMenuArgs): ItemMenuRow[] {
    if (mode === "shop") {
        return getShopItemMenu({ snapshot, item, location, emptySlot, store });
    }

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
                ),
                row(
                    "drop",
                    "Drop",
                    getDropCost(snapshot, item.id),
                    snapshot,
                    { type: "drop", itemId: item.id },
                    item.shortName
                )
            ];

            if (actionScope === "all") {
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

            const rows = buildLoadUnloadRows(snapshot, item, emptySlot);
            if (!emptySlot) {
                const contents = getAmmoSlot(item)?.contents;
                if (contents) {
                    const cost = snapshot.costs.unload + snapshot.costs.drop;
                    rows.push(
                        row(
                            "drop",
                            "Drop",
                            cost,
                            snapshot,
                            { type: "drop", itemId: contents.id },
                            contents.shortName
                        )
                    );
                }
            }

            return rows;
        }

        case "store":
            return [];
    }
}

export interface ItemMenuTarget {
    item: InventoryItemView;
    location: ItemMenuLocation;
    emptySlot: boolean;
}

/**
 * Resolve which context-menu target applies to a selected item id
 * (backpack, in-use, ground, or a filled content slot's owner).
 */
export function resolveItemMenuTarget(
    snapshot: InventorySnapshot,
    itemId: ItemId,
    store?: StoreSnapshot | null
): ItemMenuTarget | null {
    if (snapshot.inUseItemId === itemId) {
        const item = getInUseItem(snapshot);
        return item ? { item, location: "inUse", emptySlot: false } : null;
    }

    const backpack = snapshot.items.find((item: InventoryItemView) => item.id === itemId);
    if (backpack) {
        return { item: backpack, location: "inventory", emptySlot: false };
    }

    const ground = snapshot.groundItems.find((item: InventoryItemView) => item.id === itemId);
    if (ground) {
        return { item: ground, location: "ground", emptySlot: false };
    }

    if (store) {
        const storeItem = store.items.find((entry: StoreItemView) => entry.item.id === itemId);
        if (storeItem) {
            return { item: storeItem.item, location: "store", emptySlot: false };
        }
    }

    for (const root of [...snapshot.items, ...snapshot.groundItems]) {
        for (const { owner, slot } of collectContentSlots(root)) {
            if (slot.contents?.id === itemId) {
                return { item: owner, location: "slot", emptySlot: false };
            }
        }
    }

    return null;
}

/** Action-type preference order for each hotkey (first affordable menu match wins). */
const HOTKEY_ACTION_TYPES: Record<string, Array<ItemMenuAction["type"] | "pickupAndUse">> = {
    u: ["use", "unload", "pickupAndUse"],
    d: ["drop"],
    p: ["pickup", "unuse"],
    l: ["load"]
};

function rowMatchesHotkeyType(
    row: ItemMenuRow,
    type: ItemMenuAction["type"] | "pickupAndUse"
): boolean {
    if (!row.action || row.disabled) {
        return false;
    }
    if (type === "pickupAndUse") {
        return row.action.type === "pickup" && row.action.use === true;
    }
    if (type === "pickup") {
        return row.action.type === "pickup" && !row.action.use;
    }
    return row.action.type === type;
}

/**
 * Pick a menu action for a pressed hotkey from the same rows the context menu would show.
 * Parent rows with a single affordable child (e.g. Load) are included.
 */
export function findHotkeyAction(rows: ItemMenuRow[], key: string): ItemMenuAction | null {
    const types = HOTKEY_ACTION_TYPES[key.toLowerCase()];
    if (!types) {
        return null;
    }

    const actionable: ItemMenuRow[] = [];
    for (const row of rows) {
        if (row.disabled) {
            continue;
        }
        if (row.action) {
            actionable.push(row);
            continue;
        }
        const children = (row.children ?? []).filter((child) => !child.disabled && child.action);
        if (children.length === 1) {
            actionable.push(children[0]!);
        }
    }

    for (const type of types) {
        const match = actionable.find((row) => rowMatchesHotkeyType(row, type));
        if (match?.action) {
            return match.action;
        }
    }

    return null;
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

/** One line of an item's loaded contents; `depth` is the nesting level for indentation. */
export interface ItemContentLine {
    depth: number;
    text: string;
}

/**
 * Describe what an item is loaded with, all the way down: a gun lists its magazine,
 * the magazine lists its rounds. Nested combo guns (M4+M203) are named rather than
 * labelled as "Slot 0" / "Slot 1".
 */
export function describeItemContents(item: InventoryItemView, depth = 0): ItemContentLine[] {
    const lines: ItemContentLine[] = [];

    for (const slot of item.slots) {
        const { contents } = slot;

        if (isNestedItemSlot(slot.slot)) {
            if (contents) {
                lines.push({ depth, text: contents.name });
                lines.push(...describeItemContents(contents, depth + 1));
            }
            continue;
        }

        const label = slotLabel(slot.slot);
        if (!contents) {
            lines.push({ depth, text: `${label}: empty` });
            continue;
        }

        const quantity = contents.quantity > 1 ? ` ×${contents.quantity}/${slot.maxQuantity}` : "";
        lines.push({ depth, text: `${label}: ${contents.name}${quantity}` });
        lines.push(...describeItemContents(contents, depth + 1));
    }

    return lines;
}

export type InventoryDragSource =
    | { type: "inventory"; item: InventoryItemView }
    | { type: "inUse"; item: InventoryItemView }
    | { type: "ground"; item: InventoryItemView }
    | { type: "slot"; owner: InventoryItemView; item: InventoryItemView }
    | { type: "store"; item: InventoryItemView; itemId: ItemId };

export type InventoryDragTarget =
    | { type: "inUse" }
    | { type: "inventory"; overItemId?: ItemId }
    | { type: "ground" }
    | { type: "slot"; owner: InventoryItemView }
    | { type: "store" };

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
    target,
    store = null
}: {
    snapshot: InventorySnapshot;
    actionScope: InventoryActionScope;
    source: InventoryDragSource;
    target: InventoryDragTarget;
    store?: StoreSnapshot | null;
}): InventoryDragResult | null {
    if (store && (source.type === "store" || target.type === "store")) {
        return resolveShopDrag({ snapshot, source, target, store });
    }

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
                    const cost = getDropCost(snapshot, source.item.id);
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
                case "store":
                    return null;
            }
            return null;
        }
        case "store":
            return null;
    }

    return null;
}

function resolveShopDrag({
    snapshot,
    source,
    target,
    store
}: {
    snapshot: InventorySnapshot;
    source: InventoryDragSource;
    target: InventoryDragTarget;
    store: StoreSnapshot;
}): InventoryDragResult | null {
    if (source.type === "store") {
        const cost = storeBatchCost(store, source.itemId);
        const soldOut = storeBatchQuantity(store, source.itemId) <= 0;
        if (soldOut || !canAffordStore(store, cost)) {
            return null;
        }

        switch (target.type) {
            case "inventory":
                return {
                    action: { type: "buy", itemId: source.itemId },
                    pendingCostText: formatPendingMoney(
                        "Buy",
                        source.item.shortName,
                        cost,
                        store.currency
                    )
                };
            case "inUse":
                return {
                    action: { type: "buy", itemId: source.itemId, use: true },
                    pendingCostText: formatPendingMoney(
                        "Buy and use",
                        source.item.shortName,
                        cost,
                        store.currency
                    )
                };
            case "slot":
                if (
                    !target.owner.slots.some((slot: InventoryItemView["slots"][number]) =>
                        slot.compatibleIds.some(
                            (compatibleId: ItemId) =>
                                compatibleId === source.itemId ||
                                matchesCompatibleId(source.item.id, compatibleId)
                        )
                    )
                ) {
                    return null;
                }
                return {
                    action: {
                        type: "load",
                        receiverId: target.owner.id,
                        ammoId: source.itemId
                    },
                    pendingCostText: formatPendingMoney(
                        "Buy and load",
                        source.item.shortName,
                        cost,
                        store.currency
                    )
                };
            default:
                return null;
        }
    }

    if (target.type === "store") {
        const item =
            source.type === "slot"
                ? source.item
                : source.type === "inventory" || source.type === "inUse"
                  ? source.item
                  : null;
        if (!item) {
            return null;
        }
        return {
            action: { type: "sell", itemId: item.id, quantity: item.quantity },
            pendingCostText: formatPendingMoney("Sell", item.shortName, 0)
        };
    }

    if (source.type === "slot" && target.type === "inventory") {
        return {
            action: { type: "unload", itemId: source.owner.id },
            pendingCostText: formatPendingMoney("Unload", source.item.shortName, 0)
        };
    }

    if (source.type === "inventory" && target.type === "inUse") {
        if (source.item.id === snapshot.inUseItemId) {
            return null;
        }
        return {
            action: { type: "use", itemId: source.item.id },
            pendingCostText: formatPendingMoney("Use", source.item.shortName, 0)
        };
    }

    if (source.type === "inUse" && target.type === "inventory") {
        return {
            action: { type: "unuse" },
            pendingCostText: formatPendingMoney("Put away", source.item.shortName, 0)
        };
    }

    if ((source.type === "inventory" || source.type === "inUse") && target.type === "slot") {
        if (!canLoadIntoSlot(target.owner, source.item)) {
            return null;
        }
        return {
            action: { type: "load", receiverId: target.owner.id, ammoId: source.item.id },
            pendingCostText: formatPendingMoney("Load", source.item.shortName, 0)
        };
    }

    return null;
}
