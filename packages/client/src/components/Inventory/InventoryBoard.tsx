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
import { Box, Menu, MenuItem, SxProps, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
    useCallback,
    useEffect,
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

const panelSx = {
    // borderRadius: 2,
    border: "1px black solid",
    backgroundColor: "beige",
    p: 1
} as const;

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
                outline: highlighted ? "2px solid #333" : "none",
                outlineOffset: -2,
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
    onClick,
    onMenuClick
}: {
    item: InventoryItemView;
    selected: boolean;
    dragDisabled: boolean;
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
                opacity: isDragging ? 0.5 : 1,
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
    const [activeDragItem, setActiveDragItem] = useState<InventoryItemView | null>(null);
    const [legalOverId, setLegalOverId] = useState<string | null>(null);

    useEffect(() => {
        setItems(snapshot.items);
    }, [snapshot.items]);

    useEffect(() => {
        if (selectedItemId && !findItemInSnapshot(snapshot, selectedItemId)) {
            setSelectedItemId(snapshot.inUseItemId);
        }
    }, [snapshot, selectedItemId]);

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

    const loadSubmenu = menuRows.find((row) => row.id === "load")?.children ?? [];

    const closeMenu = useCallback(() => {
        setMenu(null);
        setSubMenuAnchor(null);
        onPendingCostChange(null);
    }, [onPendingCostChange]);

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

    const clearDragPreview = useCallback(() => {
        setActiveDragItem(null);
        setLegalOverId(null);
        onPendingCostChange(null);
    }, [onPendingCostChange]);

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
            setMenu(null);
            setSubMenuAnchor(null);
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
            onPendingCostChange(result?.pendingCostText ?? null);
            setLegalOverId(result && event.over ? String(event.over.id) : null);
        },
        [onPendingCostChange, resolveHover]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            clearDragPreview();
            if (!over || disabled) {
                return;
            }

            const source = dragSourceFromData(active.data.current);
            const activeInventoryId = String(active.id).startsWith("inventory:")
                ? String(active.id).slice("inventory:".length)
                : null;
            const overInventoryId = String(over.id).startsWith("inventory:")
                ? String(over.id).slice("inventory:".length)
                : null;

            if (
                source?.type === "inventory" &&
                activeInventoryId &&
                overInventoryId &&
                activeInventoryId !== overInventoryId
            ) {
                const fromIndex = items.findIndex(
                    (item: InventoryItemView) => item.id === activeInventoryId
                );
                const toIndex = items.findIndex(
                    (item: InventoryItemView) => item.id === overInventoryId
                );
                if (fromIndex >= 0 && toIndex >= 0) {
                    setItems(arrayMove(items, fromIndex, toIndex));
                    onReorder(fromIndex, toIndex);
                }
                return;
            }

            const target = dragTargetFromOver({ id: over.id, data: over.data });
            const result = resolveHover(source, target);
            if (!result) {
                return;
            }

            dispatchMenuAction(result.action, {
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
            onUse,
            onUnuse,
            onDrop,
            onPickup,
            onLoad,
            onUnload
        ]
    );

    const inUseMenuClick = inUseItem ? getMenuClickHandler(inUseItem, "inUse") : undefined;

    return (
        <InventoryTooltipDismissProvider>
            <DndContext
                sensors={sensors}
                collisionDetection={inventoryCollisionDetection}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragCancel={clearDragPreview}
                onDragEnd={handleDragEnd}
            >
                <InventoryBoardFrame disabled={disabled} sx={sx}>
                    <DroppableZone
                        id="zone:in-use"
                        target={{ type: "inUse" }}
                        highlighted={legalOverId === "zone:in-use"}
                        sx={{
                            gridArea: "in-use",
                            ...panelSx,
                            width: 180,
                            p: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{ textAlign: "center", lineHeight: 1.2 }}
                        >
                            In use
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
                                    justifyContent: "center"
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{ color: "#666", textAlign: "center" }}
                                >
                                    None
                                </Typography>
                            </Box>
                        )}
                    </DroppableZone>

                    <Box
                        sx={{
                            gridArea: "inspector",
                            overflow: "hidden",
                            ...panelSx
                        }}
                    >
                        <ItemInspector
                            item={inspectorItem}
                            emptyText={
                                inspectorFocus === "inUse" ? "No item in use" : "Select an item"
                            }
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
                            ...panelSx
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{ textAlign: "center", p: 1, lineHeight: 1.2 }}
                        >
                            Inventory
                        </Typography>
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                overflow: "auto",
                                px: 0,
                                m: "auto",
                                pb: 1
                            }}
                        >
                            <SortableContext
                                items={items.map(
                                    (item: InventoryItemView) => `inventory:${item.id}`
                                )}
                                strategy={rectSortingStrategy}
                            >
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                    {items.map((item: InventoryItemView) => (
                                        <SortableBackpackTile
                                            key={item.id}
                                            item={item}
                                            selected={selectedItemId === item.id}
                                            dragDisabled={disabled}
                                            onClick={() => setSelectedItemId(item.id)}
                                            onMenuClick={getMenuClickHandler(
                                                item,
                                                item.id === snapshot.inUseItemId
                                                    ? "inUse"
                                                    : "inventory"
                                            )}
                                        />
                                    ))}
                                    {items.length === 0 && (
                                        <Typography variant="body2" sx={{ color: "#666" }}>
                                            Empty
                                        </Typography>
                                    )}
                                </Box>
                            </SortableContext>
                        </Box>
                    </DroppableZone>

                    {mode === "shop" ? (
                        <Box
                            sx={{
                                gridArea: "ground",
                                ...panelSx,
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
                            highlighted={legalOverId === "zone:ground"}
                            sx={{
                                gridArea: "ground",
                                ...panelSx,
                                display: "flex",
                                flexDirection: "column",
                                overflow: "hidden",
                                p: 0
                            }}
                        >
                            <Typography
                                variant="subtitle2"
                                sx={{ textAlign: "center", p: 1, flexShrink: 0 }}
                            >
                                On ground
                            </Typography>
                            <Box
                                sx={{
                                    flex: 1,
                                    minHeight: 0,
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
                            </Box>
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
                            const hasChildren = Boolean(row.children);

                            return (
                                <MenuItem
                                    key={row.id}
                                    disabled={row.disabled}
                                    onMouseEnter={(event) => {
                                        onPendingCostChange(row.pendingCostText);
                                        if (hasChildren && !row.disabled) {
                                            setSubMenuAnchor(event.currentTarget);
                                        } else {
                                            setSubMenuAnchor(null);
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        if (!hasChildren) {
                                            onPendingCostChange(null);
                                        }
                                    }}
                                    onClick={(event) => {
                                        if (hasChildren) {
                                            event.stopPropagation();
                                            setSubMenuAnchor(event.currentTarget);
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
                                                {row.cost} AP
                                            </Typography>
                                        )}
                                        {hasChildren && <ChevronRightIcon fontSize="small" />}
                                    </Box>
                                </MenuItem>
                            );
                        })}
                    </Menu>

                    <Menu
                        anchorEl={subMenuAnchor}
                        open={Boolean(subMenuAnchor) && loadSubmenu.length > 0}
                        onClose={() => setSubMenuAnchor(null)}
                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
                        transformOrigin={{ vertical: "top", horizontal: "left" }}
                        slotProps={{
                            list: { dense: true }
                        }}
                    >
                        {loadSubmenu.map((row) => (
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
                                        {row.cost} AP
                                    </Typography>
                                </Box>
                            </MenuItem>
                        ))}
                    </Menu>
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
