import type { InventoryItemView, InventorySnapshot, ItemId } from "@atbs/shared-data";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    closestCenter,
    pointerWithin,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type CollisionDetection
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    Box,
    Collapse,
    Menu,
    MenuItem,
    MenuList,
    Popover,
    SxProps,
    Typography
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type ReactNode
} from "react";
import { ItemInspector } from "./ItemInspector";
import {
    ITEM_TILE_SIZE,
    InventoryTooltipDismissProvider,
    ItemTile,
    useDismissInventoryTooltips
} from "./ItemTile";
import {
    type InventoryActionScope,
    type InventoryDragSource,
    type InventoryDragTarget,
    type InventoryInspectorFocus,
    type InventoryMode,
    type ItemMenuAction,
    type ItemMenuLocation,
    type ItemMenuRow,
    findItemInSnapshot,
    getInUseItem,
    getItemMenu,
    resolveInventoryDrag
} from "./itemMenu";
import {
    backgroundBannerAnchorSx,
    backgroundBannerSx,
    cutoutTextSx,
    groundBackgroundSx,
    groundSlideTimeInMs,
    IN_USE_TITLE,
    INVENTORY_EMPTY_TEXT,
    INVENTORY_PANEL_BACKGROUND_COLOR,
    inventoryPanelSx,
    NO_ITEM_IN_USE_TEXT,
    ON_GROUND_BACKGROUND_COLOR,
    ON_GROUND_TITLE
} from "./styles";

export interface InventoryBoardProps {
    snapshot: InventorySnapshot;
    mode?: InventoryMode;
    actionScope?: InventoryActionScope;
    inspectorFocus?: InventoryInspectorFocus;
    disabled?: boolean;
    onUse: (itemId: ItemId) => void;
    onUnuse: () => void;
    onDrop: (itemId: ItemId) => void;
    onPickup: (itemId: ItemId, use?: boolean) => void;
    onLoad: (receiverId: ItemId, ammoId: ItemId) => void;
    onUnload: (itemId: ItemId) => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
    onPendingCostChange: (text: string | null) => void;
    sx?: SxProps;
}

interface MenuState {
    anchorEl: HTMLElement;
    item: InventoryItemView;
    location: ItemMenuLocation;
    emptySlot: boolean;
}

function dispatchMenuAction(
    action: ItemMenuAction,
    callbacks: Pick<
        InventoryBoardProps,
        "onUse" | "onUnuse" | "onDrop" | "onPickup" | "onLoad" | "onUnload"
    >
) {
    switch (action.type) {
        case "use":
            callbacks.onUse(action.itemId);
            break;
        case "unuse":
            callbacks.onUnuse();
            break;
        case "drop":
            callbacks.onDrop(action.itemId);
            break;
        case "pickup":
            callbacks.onPickup(action.itemId, action.use);
            break;
        case "load":
            callbacks.onLoad(action.receiverId, action.ammoId);
            break;
        case "unload":
            callbacks.onUnload(action.itemId);
            break;
    }
}

const inventoryCollisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length === 0) {
        return closestCenter(args);
    }

    const slots = pointerHits.filter((collision) => String(collision.id).startsWith("slot:"));
    if (slots.length > 0) {
        return slots;
    }

    const sourceType = (args.active.data.current as { source?: InventoryDragSource } | undefined)
        ?.source?.type;
    if (sourceType === "inventory") {
        const sortables = pointerHits.filter((collision) =>
            String(collision.id).startsWith("inventory:")
        );
        if (sortables.length > 0) {
            return sortables;
        }
    }

    // Prefer ground when hit so layout shifts while the empty-ground preview
    // expands do not flip the active target to the inventory zone above.
    const ground = pointerHits.filter((collision) => String(collision.id) === "zone:ground");
    if (ground.length > 0) {
        return ground;
    }

    const zones = pointerHits.filter((collision) => String(collision.id).startsWith("zone:"));
    if (zones.length > 0) {
        return zones;
    }

    return pointerHits;
};

function dragSourceFromData(data: unknown): InventoryDragSource | null {
    return (data as { source?: InventoryDragSource } | undefined)?.source ?? null;
}

function dragTargetFromOver(
    over: { id: string | number; data: { current?: { target?: InventoryDragTarget } } } | null
): InventoryDragTarget | null {
    if (!over) {
        return null;
    }
    if (over.data.current?.target) {
        return over.data.current.target;
    }
    const id = String(over.id);
    if (id.startsWith("inventory:")) {
        return { type: "inventory", overItemId: id.slice("inventory:".length) };
    }
    return null;
}

function DroppableZone({
    id,
    target,
    highlighted,
    children,
    sx
}: {
    id: string;
    target: InventoryDragTarget;
    highlighted: boolean;
    children: ReactNode;
    sx?: SxProps;
}) {
    const { setNodeRef } = useDroppable({ id, data: { target } });
    return (
        <Box
            ref={setNodeRef}
            sx={{
                // Inset shadow avoids the “padding jump” look of toggling outline.
                boxShadow: highlighted ? "inset 0 0 0 2px #333" : "none",
                ...sx
            }}
        >
            {children}
        </Box>
    );
}

function DraggableItemTile({
    id,
    source,
    item,
    selected,
    onClick,
    onMenuClick
}: {
    id: string;
    source: InventoryDragSource;
    item: InventoryItemView;
    selected: boolean;
    onClick: () => void;
    onMenuClick?: (event: MouseEvent<HTMLElement>) => void;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id,
        data: { source }
    });

    return (
        <Box ref={setNodeRef} sx={{ opacity: isDragging ? 0.4 : 1, flexShrink: 0 }}>
            <ItemTile
                item={item}
                selected={selected}
                draggable
                dragHandleAttributes={attributes}
                dragHandleListeners={listeners}
                onClick={onClick}
                onMenuClick={onMenuClick}
            />
        </Box>
    );
}

function SortableBackpackTile({
    item,
    selected,
    dragDisabled,
    dropPreview = false,
    onClick,
    onMenuClick
}: {
    item: InventoryItemView;
    selected: boolean;
    dragDisabled: boolean;
    dropPreview?: boolean;
    onClick: () => void;
    onMenuClick?: (event: MouseEvent<HTMLElement>) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `inventory:${item.id}`,
        disabled: dragDisabled,
        data: { source: { type: "inventory", item } satisfies InventoryDragSource }
    });

    return (
        <Box
            data-testid={`inventory-board-item-${item.id}`}
            ref={setNodeRef}
            sx={{
                transform: CSS.Transform.toString(transform),
                transition,
                aspectRatio: 1,
                opacity: isDragging || dropPreview ? 0.5 : 1,
                zIndex: isDragging ? 1 : 0
            }}
        >
            <ItemTile
                item={item}
                selected={selected}
                draggable
                dragHandleAttributes={attributes}
                dragHandleListeners={listeners}
                onClick={onClick}
                onMenuClick={onMenuClick}
            />
        </Box>
    );
}

function InventoryBoardFrame({
    disabled,
    sx,
    children
}: {
    disabled: boolean;
    sx?: SxProps;
    children: ReactNode;
}) {
    const dismissTooltips = useDismissInventoryTooltips();
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = rootRef.current;
        if (!node) {
            return;
        }

        const onScroll = () => dismissTooltips();
        node.addEventListener("scroll", onScroll, { capture: true, passive: true });
        return () => node.removeEventListener("scroll", onScroll, { capture: true });
    }, [dismissTooltips]);

    return (
        <Box
            ref={rootRef}
            data-testid="inventory-board"
            sx={{
                display: "grid",
                gridTemplateAreas: `
                    'in-use inspector'
                    'inventory inventory'
                    'ground ground'
                `,
                gridTemplateColumns: "auto 1fr",
                gridTemplateRows: `calc(204px + 8px + 8px + 1px + 1px) 1fr auto`,
                gap: 1,
                height: "100%",
                minHeight: 0,
                overflow: "hidden",
                pointerEvents: disabled ? "none" : "auto",
                ...sx
            }}
        >
            {children}
        </Box>
    );
}

export function InventoryBoard({
    snapshot,
    mode = "action",
    actionScope = "inUse",
    inspectorFocus = "inUse",
    disabled = false,
    onUse,
    onUnuse,
    onDrop,
    onPickup,
    onLoad,
    onUnload,
    onReorder,
    onPendingCostChange,
    sx
}: InventoryBoardProps) {
    const [items, setItems] = useState<InventoryItemView[]>(snapshot.items);
    const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(snapshot.inUseItemId);
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [subMenuAnchor, setSubMenuAnchor] = useState<HTMLElement | null>(null);
    const [subMenuRows, setSubMenuRows] = useState<ItemMenuRow[]>([]);
    const subMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const subMenuRowIdRef = useRef<string | null>(null);
    const subMenuPaperRef = useRef<HTMLElement | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<InventoryItemView | null>(null);
    const [activeDragSource, setActiveDragSource] = useState<InventoryDragSource | null>(null);
    const [legalOverId, setLegalOverId] = useState<string | null>(null);
    /** Ghost (and expand latch) for dropping onto an empty ground row. */
    const [groundDropPreviewItem, setGroundDropPreviewItem] = useState<InventoryItemView | null>(
        null
    );
    /** Keeps ground row height while Collapse animates closed after the last item leaves. */
    const [closingGroundItem, setClosingGroundItem] = useState<InventoryItemView | null>(null);
    const [groundClosingOpen, setGroundClosingOpen] = useState(false);
    const previousGroundItemsRef = useRef(snapshot.groundItems);

    if (snapshot.groundItems.length > 0) {
        if (closingGroundItem !== null || groundClosingOpen) {
            setClosingGroundItem(null);
            setGroundClosingOpen(false);
        }
    } else if (
        previousGroundItemsRef.current.length > 0 &&
        closingGroundItem === null &&
        groundDropPreviewItem === null
    ) {
        const removed = previousGroundItemsRef.current[0];
        if (removed) {
            setClosingGroundItem(removed);
            setGroundClosingOpen(true);
        }
    }
    previousGroundItemsRef.current = snapshot.groundItems;

    useEffect(() => {
        setItems(snapshot.items);
    }, [snapshot.items]);

    useEffect(() => {
        if (selectedItemId && !findItemInSnapshot(snapshot, selectedItemId)) {
            setSelectedItemId(snapshot.inUseItemId);
        }
    }, [snapshot, selectedItemId]);

    useEffect(() => {
        // Hand off from ghost to real ground tiles without collapsing.
        if (snapshot.groundItems.length > 0 && groundDropPreviewItem) {
            setGroundDropPreviewItem(null);
        }
    }, [snapshot.groundItems, groundDropPreviewItem]);

    useLayoutEffect(() => {
        if (!closingGroundItem || !groundClosingOpen) {
            return;
        }
        const frame = requestAnimationFrame(() => {
            setGroundClosingOpen(false);
        });
        return () => cancelAnimationFrame(frame);
    }, [closingGroundItem, groundClosingOpen]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 }
        })
    );

    const inUseItem = getInUseItem(snapshot);
    const selectedItem = selectedItemId ? findItemInSnapshot(snapshot, selectedItemId) : null;
    const inspectorItem = inspectorFocus === "inUse" ? inUseItem : selectedItem;
    const slotsInteractive = actionScope === "all" || inspectorItem?.id === snapshot.inUseItemId;
    const menuRows: ItemMenuRow[] = useMemo(() => {
        if (!menu) {
            return [];
        }

        return getItemMenu({
            snapshot,
            item: menu.item,
            location: menu.location,
            actionScope,
            emptySlot: menu.emptySlot
        });
    }, [menu, snapshot, actionScope]);

    const clearSubMenuCloseTimeout = useCallback(() => {
        if (subMenuCloseTimeoutRef.current !== null) {
            clearTimeout(subMenuCloseTimeoutRef.current);
            subMenuCloseTimeoutRef.current = null;
        }
    }, []);

    const openSubMenu = useCallback(
        (anchor: HTMLElement, children: ItemMenuRow[], rowId: string) => {
            clearSubMenuCloseTimeout();
            // Avoid setState when this submenu is already open — re-rendering the parent
            // Menu remounts the Load row, which fires leave/enter and flickers the submenu.
            if (subMenuRowIdRef.current === rowId) {
                setSubMenuAnchor((current) => (current === anchor ? current : anchor));
                return;
            }
            subMenuRowIdRef.current = rowId;
            setSubMenuAnchor(anchor);
            setSubMenuRows(children);
        },
        [clearSubMenuCloseTimeout]
    );

    const closeSubMenu = useCallback(() => {
        clearSubMenuCloseTimeout();
        subMenuRowIdRef.current = null;
        setSubMenuAnchor(null);
        setSubMenuRows([]);
    }, [clearSubMenuCloseTimeout]);

    const scheduleCloseSubMenu = useCallback(() => {
        clearSubMenuCloseTimeout();
        subMenuCloseTimeoutRef.current = setTimeout(() => {
            subMenuRowIdRef.current = null;
            setSubMenuAnchor(null);
            setSubMenuRows([]);
            subMenuCloseTimeoutRef.current = null;
        }, 200);
    }, [clearSubMenuCloseTimeout]);

    const closeMenu = useCallback(() => {
        setMenu(null);
        closeSubMenu();
        onPendingCostChange(null);
    }, [closeSubMenu, onPendingCostChange]);

    const openMenu = useCallback(
        (
            item: InventoryItemView,
            location: ItemMenuLocation,
            event: MouseEvent<HTMLElement>,
            emptySlot = false
        ) => {
            if (disabled) {
                return;
            }

            event.stopPropagation();
            if (location !== "slot") {
                setSelectedItemId(item.id);
            }
            setSubMenuAnchor(null);
            setSubMenuRows([]);
            subMenuRowIdRef.current = null;
            onPendingCostChange(null);

            const rows = getItemMenu({
                snapshot,
                item,
                location,
                actionScope,
                emptySlot
            });
            if (rows.length === 0) {
                setMenu(null);
                return;
            }

            setMenu({
                anchorEl: event.currentTarget,
                item,
                location,
                emptySlot
            });
        },
        [disabled, onPendingCostChange, snapshot, actionScope]
    );

    const getMenuClickHandler = useCallback(
        (item: InventoryItemView, location: ItemMenuLocation, emptySlot = false) => {
            const rows = getItemMenu({
                snapshot,
                item,
                location,
                actionScope,
                emptySlot
            });
            if (rows.length === 0) {
                return undefined;
            }

            return (event: MouseEvent<HTMLElement>) => {
                openMenu(item, location, event, emptySlot);
            };
        },
        [snapshot, actionScope, openMenu]
    );

    const handleAction = useCallback(
        (action: ItemMenuAction | null) => {
            if (!action || disabled) {
                return;
            }

            dispatchMenuAction(action, { onUse, onUnuse, onDrop, onPickup, onLoad, onUnload });
            closeMenu();
        },
        [disabled, onUse, onUnuse, onDrop, onPickup, onLoad, onUnload, closeMenu]
    );

    const clearDragPreview = useCallback(
        (options?: { keepGroundPreview?: boolean }) => {
            setActiveDragItem(null);
            setActiveDragSource(null);
            setLegalOverId(null);
            if (!options?.keepGroundPreview) {
                setGroundDropPreviewItem(null);
            }
            onPendingCostChange(null);
        },
        [onPendingCostChange]
    );

    const resolveHover = useCallback(
        (source: InventoryDragSource | null, target: InventoryDragTarget | null) => {
            if (!source || !target) {
                return null;
            }
            return resolveInventoryDrag({ snapshot, actionScope, source, target });
        },
        [snapshot, actionScope]
    );

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const source = dragSourceFromData(event.active.data.current);
            setActiveDragItem(source?.item ?? null);
            setActiveDragSource(source);
            setGroundDropPreviewItem(null);
            setMenu(null);
            setSubMenuAnchor(null);
            setSubMenuRows([]);
            subMenuRowIdRef.current = null;
            onPendingCostChange(null);
        },
        [onPendingCostChange]
    );

    const handleDragOver = useCallback(
        (event: DragOverEvent) => {
            const source = dragSourceFromData(event.active.data.current);
            const target = dragTargetFromOver(
                event.over ? { id: event.over.id, data: event.over.data } : null
            );
            const result = resolveHover(source, target);
            const movingToInventoryEnd =
                source?.type === "inventory" &&
                target?.type === "inventory" &&
                !target.overItemId &&
                items.findIndex((item: InventoryItemView) => item.id === source.item.id) !==
                    items.length - 1;
            const overId = event.over ? String(event.over.id) : null;
            onPendingCostChange(result?.pendingCostText ?? null);
            setLegalOverId(overId && (result || movingToInventoryEnd) ? overId : null);

            // Latch the empty-ground expand open once entered. Layout reflow while
            // the section grows briefly loses zone:ground; closing on that flicker
            // fights the Collapse animation.
            if (overId === "zone:ground" && result && source) {
                setGroundDropPreviewItem(source.item);
                setClosingGroundItem(null);
                setGroundClosingOpen(false);
            } else if (
                overId &&
                overId !== "zone:ground" &&
                (result || movingToInventoryEnd) &&
                target?.type !== "ground"
            ) {
                setGroundDropPreviewItem(null);
            }
        },
        [items, onPendingCostChange, resolveHover]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            const source = dragSourceFromData(active.data.current);
            const target = over ? dragTargetFromOver({ id: over.id, data: over.data }) : null;
            const dropResult = over && !disabled ? resolveHover(source, target) : null;
            const keepGroundPreview =
                dropResult?.action.type === "drop" &&
                target?.type === "ground" &&
                snapshot.groundItems.length === 0;

            clearDragPreview({ keepGroundPreview });
            if (!over || disabled) {
                return;
            }

            const activeInventoryId = String(active.id).startsWith("inventory:")
                ? String(active.id).slice("inventory:".length)
                : null;
            const overInventoryId = String(over.id).startsWith("inventory:")
                ? String(over.id).slice("inventory:".length)
                : null;

            if (source?.type === "inventory" && activeInventoryId) {
                const droppingOnInventoryItem = Boolean(overInventoryId);
                const droppingOnInventoryZone = String(over.id) === "zone:inventory";
                if (droppingOnInventoryItem || droppingOnInventoryZone) {
                    const fromIndex = items.findIndex(
                        (item: InventoryItemView) => item.id === activeInventoryId
                    );
                    const toIndex = droppingOnInventoryItem
                        ? items.findIndex((item: InventoryItemView) => item.id === overInventoryId)
                        : items.length - 1;
                    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                        setItems(arrayMove(items, fromIndex, toIndex));
                        onReorder(fromIndex, toIndex);
                    }
                    return;
                }
            }

            if (!dropResult) {
                return;
            }

            dispatchMenuAction(dropResult.action, {
                onUse,
                onUnuse,
                onDrop,
                onPickup,
                onLoad,
                onUnload
            });
        },
        [
            clearDragPreview,
            disabled,
            items,
            onReorder,
            resolveHover,
            snapshot.groundItems.length,
            onUse,
            onUnuse,
            onDrop,
            onPickup,
            onLoad,
            onUnload
        ]
    );

    const inUseMenuClick = inUseItem ? getMenuClickHandler(inUseItem, "inUse") : undefined;

    const previewingInventoryDrop =
        legalOverId != null &&
        (legalOverId === "zone:inventory" || legalOverId.startsWith("inventory:")) &&
        (activeDragSource?.type === "inUse" ||
            activeDragSource?.type === "slot" ||
            activeDragSource?.type === "ground");
    const inventoryInsertPreviewItem =
        previewingInventoryDrop &&
        (activeDragSource?.type === "slot" || activeDragSource?.type === "ground")
            ? activeDragItem
            : null;
    const inventoryPutAwayPreviewItemId =
        previewingInventoryDrop && activeDragSource?.type === "inUse"
            ? activeDragSource.item.id
            : null;
    const groundDropPreview =
        groundDropPreviewItem && snapshot.groundItems.length === 0 ? groundDropPreviewItem : null;
    const groundClosingPreview =
        !groundDropPreview && snapshot.groundItems.length === 0 ? closingGroundItem : null;
    const groundGhost = groundDropPreview ?? groundClosingPreview;
    const showGroundItemRow =
        snapshot.groundItems.length > 0 ||
        groundDropPreview != null ||
        (closingGroundItem != null && groundClosingOpen);

    return (
        <InventoryTooltipDismissProvider>
            <DndContext
                sensors={sensors}
                collisionDetection={inventoryCollisionDetection}
                autoScroll={false}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragCancel={() => clearDragPreview()}
                onDragEnd={handleDragEnd}
            >
                <InventoryBoardFrame disabled={disabled} sx={sx}>
                    <DroppableZone
                        id="zone:in-use"
                        target={{ type: "inUse" }}
                        highlighted={legalOverId === "zone:in-use"}
                        sx={{
                            gridArea: "in-use",
                            ...inventoryPanelSx,
                            width: 180,
                            p: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                            backgroundColor: "lightgray"
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{
                                textAlign: "center",
                                lineHeight: 1.2,
                                ...cutoutTextSx(INVENTORY_PANEL_BACKGROUND_COLOR)
                            }}
                        >
                            {IN_USE_TITLE}
                        </Typography>
                        {inUseItem ? (
                            <DraggableItemTile
                                id={`inUse:${inUseItem.id}`}
                                source={{ type: "inUse", item: inUseItem }}
                                item={inUseItem}
                                selected={selectedItemId === inUseItem.id}
                                onClick={() => setSelectedItemId(inUseItem.id)}
                                onMenuClick={inUseMenuClick}
                            />
                        ) : (
                            <Box
                                sx={{
                                    width: ITEM_TILE_SIZE,
                                    height: ITEM_TILE_SIZE,
                                    flexShrink: 0,
                                    border: "1px dashed #666",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    ...backgroundBannerAnchorSx
                                }}
                            >
                                <Typography variant="body2" sx={backgroundBannerSx}>
                                    {NO_ITEM_IN_USE_TEXT}
                                </Typography>
                            </Box>
                        )}
                    </DroppableZone>

                    <Box
                        sx={{
                            gridArea: "inspector",
                            overflow: "hidden",
                            ...inventoryPanelSx,
                            backgroundColor: "lightgray"
                        }}
                    >
                        <ItemInspector
                            item={inspectorItem}
                            emptyText={inspectorFocus === "inUse" ? "" : "Select an item"}
                            slotsInteractive={slotsInteractive}
                            highlightedSlotId={
                                legalOverId?.startsWith("slot:") ? legalOverId : null
                            }
                            getSlotMenuClick={(owner, empty) =>
                                getMenuClickHandler(owner, "slot", empty)
                            }
                        />
                    </Box>

                    <DroppableZone
                        id="zone:inventory"
                        target={{ type: "inventory" }}
                        highlighted={legalOverId === "zone:inventory"}
                        sx={{
                            gridArea: "inventory",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            ...inventoryPanelSx,
                            p: 0
                        }}
                    >
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                overflowY: "auto",
                                p: 0,
                                m: 0,
                                backgroundColor: "gray"
                            }}
                        >
                            <SortableContext
                                items={items.map(
                                    (item: InventoryItemView) => `inventory:${item.id}`
                                )}
                                strategy={rectSortingStrategy}
                            >
                                <Box
                                    data-testid="inventory-items"
                                    sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignContent: "flex-start",
                                        gap: 1,
                                        p: 1
                                    }}
                                >
                                    {items.map((item: InventoryItemView) => (
                                        <SortableBackpackTile
                                            key={item.id}
                                            item={item}
                                            selected={selectedItemId === item.id}
                                            dragDisabled={disabled}
                                            dropPreview={inventoryPutAwayPreviewItemId === item.id}
                                            onClick={() => setSelectedItemId(item.id)}
                                            onMenuClick={getMenuClickHandler(
                                                item,
                                                item.id === snapshot.inUseItemId
                                                    ? "inUse"
                                                    : "inventory"
                                            )}
                                        />
                                    ))}
                                    {inventoryInsertPreviewItem && (
                                        <Box
                                            data-testid="inventory-drop-preview"
                                            sx={{
                                                opacity: 0.5,
                                                aspectRatio: 1,
                                                flexShrink: 0,
                                                pointerEvents: "none"
                                            }}
                                        >
                                            <ItemTile
                                                item={inventoryInsertPreviewItem}
                                                tooltip={false}
                                            />
                                        </Box>
                                    )}
                                    {items.length === 0 && !inventoryInsertPreviewItem && (
                                        <Box
                                            data-testid="inventory-empty"
                                            sx={{
                                                width: "100%",
                                                height: "100%",
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                ...backgroundBannerAnchorSx
                                            }}
                                        >
                                            <Typography variant="body2" sx={backgroundBannerSx}>
                                                {INVENTORY_EMPTY_TEXT}
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </SortableContext>
                        </Box>
                    </DroppableZone>

                    {mode === "shop" ? (
                        <Box
                            sx={{
                                gridArea: "ground",
                                ...inventoryPanelSx,
                                display: "flex",
                                flexDirection: "column",
                                overflow: "hidden",
                                p: 0
                            }}
                        >
                            <Typography
                                variant="subtitle2"
                                sx={{ textAlign: "center", color: "#666", p: 1 }}
                            >
                                Store
                            </Typography>
                        </Box>
                    ) : (
                        <DroppableZone
                            id="zone:ground"
                            target={{ type: "ground" }}
                            highlighted={legalOverId === "zone:ground" || groundDropPreview != null}
                            sx={{
                                gridArea: "ground",
                                ...inventoryPanelSx,
                                display: "flex",
                                flexDirection: "column",
                                overflow: "hidden",
                                p: 0,
                                ...groundBackgroundSx
                            }}
                        >
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    textAlign: "center",
                                    p: 1,
                                    flexShrink: 0,
                                    ...cutoutTextSx(ON_GROUND_BACKGROUND_COLOR)
                                }}
                            >
                                {ON_GROUND_TITLE}
                            </Typography>
                            <Collapse
                                in={showGroundItemRow}
                                timeout={groundSlideTimeInMs}
                                onExited={() => setClosingGroundItem(null)}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexWrap: "nowrap",
                                        gap: 1,
                                        p: 1,
                                        pb: 2,
                                        overflow: "auto"
                                    }}
                                >
                                    {snapshot.groundItems.map((item: InventoryItemView) => (
                                        <DraggableItemTile
                                            key={item.id}
                                            id={`ground:${item.id}`}
                                            source={{ type: "ground", item }}
                                            item={item}
                                            selected={selectedItemId === item.id}
                                            onClick={() => setSelectedItemId(item.id)}
                                            onMenuClick={getMenuClickHandler(item, "ground")}
                                        />
                                    ))}
                                    {groundGhost && (
                                        <Box
                                            data-testid="ground-drop-preview"
                                            sx={{
                                                opacity: 0.5,
                                                flexShrink: 0,
                                                pointerEvents: "none"
                                            }}
                                        >
                                            <ItemTile item={groundGhost} tooltip={false} />
                                        </Box>
                                    )}
                                </Box>
                            </Collapse>
                        </DroppableZone>
                    )}

                    <Menu
                        open={Boolean(menu) && menuRows.length > 0}
                        onClose={closeMenu}
                        anchorEl={menu?.anchorEl}
                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        transformOrigin={{ vertical: "top", horizontal: "right" }}
                        slotProps={{
                            list: { dense: true }
                        }}
                    >
                        {menuRows.map((row) => {
                            const hasChildren = Boolean(row.children?.length);

                            return (
                                <MenuItem
                                    key={row.id}
                                    disabled={row.disabled}
                                    onMouseEnter={(event) => {
                                        onPendingCostChange(row.pendingCostText);
                                        if (hasChildren && !row.disabled && row.children) {
                                            openSubMenu(event.currentTarget, row.children, row.id);
                                        } else {
                                            closeSubMenu();
                                        }
                                    }}
                                    onMouseLeave={(event) => {
                                        if (hasChildren) {
                                            const related = event.relatedTarget;
                                            if (
                                                related instanceof Node &&
                                                subMenuPaperRef.current?.contains(related)
                                            ) {
                                                return;
                                            }
                                            scheduleCloseSubMenu();
                                        } else {
                                            onPendingCostChange(null);
                                        }
                                    }}
                                    onClick={() => {
                                        if (hasChildren) {
                                            return;
                                        }
                                        handleAction(row.action);
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            width: "100%",
                                            gap: 1,
                                            justifyContent: "space-between"
                                        }}
                                    >
                                        <Typography variant="caption">{row.label}</Typography>
                                        {!hasChildren && (
                                            <Typography
                                                variant="caption"
                                                sx={{ color: "#666", textAlign: "right" }}
                                            >
                                                {row.cost} APts
                                            </Typography>
                                        )}
                                        {hasChildren && <ChevronRightIcon fontSize="small" />}
                                    </Box>
                                </MenuItem>
                            );
                        })}
                    </Menu>

                    <Popover
                        open={Boolean(subMenuAnchor) && subMenuRows.length > 0}
                        anchorEl={subMenuAnchor}
                        onClose={closeSubMenu}
                        disableRestoreFocus
                        disableAutoFocus
                        disableEnforceFocus
                        disableScrollLock
                        marginThreshold={0}
                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
                        transformOrigin={{ vertical: "top", horizontal: "left" }}
                        slotProps={{
                            root: {
                                // Nested menu: don't capture pointer outside the paper.
                                sx: { pointerEvents: "none" }
                            },
                            paper: {
                                ref: subMenuPaperRef,
                                sx: { pointerEvents: "auto" },
                                onMouseEnter: clearSubMenuCloseTimeout,
                                onMouseLeave: scheduleCloseSubMenu
                            }
                        }}
                    >
                        <MenuList dense>
                            {subMenuRows.map((row) => (
                                <MenuItem
                                    key={row.id}
                                    disabled={row.disabled}
                                    onMouseEnter={() => onPendingCostChange(row.pendingCostText)}
                                    onMouseLeave={() => onPendingCostChange(null)}
                                    onClick={() => handleAction(row.action)}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            width: "100%",
                                            gap: 1,
                                            justifyContent: "space-between"
                                        }}
                                    >
                                        <Typography variant="caption">{row.label}</Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{ color: "#666", textAlign: "right" }}
                                        >
                                            {row.cost} APts
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </MenuList>
                    </Popover>
                </InventoryBoardFrame>
                <DragOverlay dropAnimation={null} style={{ pointerEvents: "none", opacity: 0.75 }}>
                    {activeDragItem ? (
                        <ItemTile item={activeDragItem} tooltip={false} sx={{ boxShadow: 6 }} />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </InventoryTooltipDismissProvider>
    );
}
