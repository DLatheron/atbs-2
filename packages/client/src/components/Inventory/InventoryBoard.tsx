import type { InventoryItemView, InventorySnapshot, ItemId } from "@atbs/shared-data";
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors
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
    type InventoryMode,
    type ItemMenuAction,
    type ItemMenuLocation,
    type ItemMenuRow,
    findItemInSnapshot,
    getInUseItem,
    getItemMenu
} from "./itemMenu";

export interface InventoryBoardProps {
    snapshot: InventorySnapshot;
    mode?: InventoryMode;
    actionScope?: InventoryActionScope;
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
    borderRadius: 2,
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
        id: item.id,
        disabled: dragDisabled
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
                gridTemplateRows: `auto 1fr auto`,
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
    const slotsInteractive = actionScope === "all" || selectedItem?.id === snapshot.inUseItemId;
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

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) {
                return;
            }

            const fromIndex = items.findIndex((item: InventoryItemView) => item.id === active.id);
            const toIndex = items.findIndex((item: InventoryItemView) => item.id === over.id);
            if (fromIndex < 0 || toIndex < 0) {
                return;
            }

            setItems(arrayMove(items, fromIndex, toIndex));
            onReorder(fromIndex, toIndex);
        },
        [items, onReorder]
    );

    const inUseMenuClick = inUseItem ? getMenuClickHandler(inUseItem, "inUse") : undefined;

    return (
        <InventoryTooltipDismissProvider>
            <InventoryBoardFrame disabled={disabled} sx={sx}>
                <Box
                    sx={{
                        gridArea: "in-use",
                        ...panelSx,
                        p: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1
                    }}
                >
                    <Typography variant="subtitle2" sx={{ textAlign: "center", lineHeight: 1.2 }}>
                        In use
                    </Typography>
                    {inUseItem ? (
                        <ItemTile
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
                                borderRadius: 1,
                                border: "1px dashed #666",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}
                        >
                            <Typography variant="body2" sx={{ color: "#666", textAlign: "center" }}>
                                None
                            </Typography>
                        </Box>
                    )}
                </Box>

                <Box sx={{ gridArea: "inspector", overflow: "hidden", height: "100%" }}>
                    <ItemInspector
                        item={selectedItem}
                        slotsInteractive={slotsInteractive}
                        getSlotMenuClick={(owner, empty) =>
                            getMenuClickHandler(owner, "slot", empty)
                        }
                    />
                </Box>

                <Box
                    sx={{
                        gridArea: "inventory",
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
                        Inventory
                    </Typography>
                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, pb: 1 }}>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={items.map((item: InventoryItemView) => item.id)}
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
                        </DndContext>
                    </Box>
                </Box>

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
                    {mode === "shop" ? (
                        <Typography
                            variant="subtitle2"
                            sx={{ textAlign: "center", color: "#666", p: 1 }}
                        >
                            Store
                        </Typography>
                    ) : (
                        <>
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
                                    <ItemTile
                                        key={item.id}
                                        item={item}
                                        selected={selectedItemId === item.id}
                                        onClick={() => setSelectedItemId(item.id)}
                                        onMenuClick={getMenuClickHandler(item, "ground")}
                                    />
                                ))}
                                {snapshot.groundItems.length === 0 && (
                                    <Typography variant="body2" sx={{ color: "#666" }}>
                                        Nothing on the ground
                                    </Typography>
                                )}
                            </Box>
                        </>
                    )}
                </Box>

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
        </InventoryTooltipDismissProvider>
    );
}
