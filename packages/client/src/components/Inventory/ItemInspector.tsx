import type { InventoryItemView } from "@atbs/shared-data";
import { Box, IconButton, Stack, SxProps, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import type { MouseEvent } from "react";
import { DescriptionComponent } from "../Description";
import { ITEM_TILE_SIZE, ItemTile } from "./ItemTile";
import { collectAmmoSlots, slotLabel } from "./itemMenu";

const panelSx = {
    // borderRadius: 2,
    // border: "1px black solid",
    // backgroundColor: "beige",
    // p: 1
} as const;

interface ItemContentSlotsProps {
    item: InventoryItemView | null;
    disabled?: boolean;
    interactive?: boolean;
    selectedSlotItemId?: string | null;
    onSlotClick?: (item: InventoryItemView) => void;
    onEmptySlotClick?: (owner: InventoryItemView) => void;
    getSlotMenuClick?: (
        item: InventoryItemView
    ) => ((event: MouseEvent<HTMLElement>) => void) | undefined;
    getEmptySlotMenuClick?: (
        owner: InventoryItemView
    ) => ((event: MouseEvent<HTMLElement>) => void) | undefined;
    sx?: SxProps;
}

export interface ItemInspectorProps {
    item: InventoryItemView | null;
    disabled?: boolean;
    /** When true, slot tiles expose load/unload menus. Defaults to read-only. */
    slotsInteractive?: boolean;
    selectedSlotItemId?: string | null;
    onSlotClick?: (item: InventoryItemView) => void;
    onEmptySlotClick?: (owner: InventoryItemView) => void;
    getSlotMenuClick?: (
        item: InventoryItemView
    ) => ((event: MouseEvent<HTMLElement>) => void) | undefined;
    getEmptySlotMenuClick?: (
        owner: InventoryItemView
    ) => ((event: MouseEvent<HTMLElement>) => void) | undefined;
    sx?: SxProps;
}

function ItemContentSlots({
    item,
    disabled = false,
    interactive = false,
    selectedSlotItemId = null,
    onSlotClick,
    onEmptySlotClick,
    getSlotMenuClick,
    getEmptySlotMenuClick,
    sx
}: ItemContentSlotsProps) {
    const ammoSlots = item ? collectAmmoSlots(item) : [];
    if (ammoSlots.length === 0) {
        return null;
    }

    return (
        <Box
            data-testid="item-contents"
            sx={{
                ...panelSx,
                p: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                ...sx
            }}
        >
            <Typography variant="subtitle2" sx={{ gridArea: "title", textAlign: "center", m: "auto", lineHeight: 1.2 }}>
                Contents
            </Typography>
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    overflowX: "auto",
                    overflowY: "hidden",
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "nowrap",
                    alignItems: "center",
                    gap: 1
                }}
            >
                {ammoSlots.map(({ owner, slot }) => {
                    const contents = slot.contents;
                    if (contents) {
                        return (
                            <ItemTile
                                key={`${owner.id}-ammo-${contents.id}`}
                                item={contents}
                                selected={selectedSlotItemId === contents.id}
                                disabled={disabled}
                                onClick={disabled ? undefined : () => onSlotClick?.(contents)}
                                onMenuClick={
                                    disabled || !interactive
                                        ? undefined
                                        : getSlotMenuClick?.(contents)
                                }
                                sx={{ flexShrink: 0 }}
                            />
                        );
                    }

                    const emptySlotMenuClick =
                        interactive && !disabled ? getEmptySlotMenuClick?.(owner) : undefined;

                    return (
                        <Box
                            key={`empty-ammo-${owner.id}`}
                            data-testid={`empty-slot-ammo-${owner.id}`}
                            onClick={disabled ? undefined : () => onEmptySlotClick?.(owner)}
                            sx={{
                                position: "relative",
                                width: ITEM_TILE_SIZE,
                                height: ITEM_TILE_SIZE,
                                flexShrink: 0,
                                borderRadius: 1,
                                border: "1px dashed #666",
                                backgroundColor: "beige",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: disabled ? "default" : "pointer",
                                opacity: disabled ? 0.5 : 1
                            }}
                        >
                            {emptySlotMenuClick && (
                                <IconButton
                                    size="small"
                                    aria-label="Slot actions"
                                    data-testid={`empty-slot-menu-ammo-${owner.id}`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        emptySlotMenuClick(event);
                                    }}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onPointerUp={(event) => event.stopPropagation()}
                                    sx={{
                                        position: "absolute",
                                        top: 0,
                                        right: 0,
                                        zIndex: 1,
                                        p: 0.25,
                                        color: "#666"
                                    }}
                                >
                                    <MenuIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            )}
                            <Typography variant="caption" sx={{ color: "#666" }}>
                                {slotLabel(slot.slot)}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

function InspectorDetails({ item, sx }: { item: InventoryItemView | null; sx?: SxProps }) {
    if (!item) {
        return (
            <Stack
                data-testid="inspector-details-none"
                sx={{
                    ...panelSx,
                    ...sx
                }}
            >
                <Typography variant="body2" sx={{ textAlign: "center", color: "#666" }}>
                    Select an item
                </Typography>
            </Stack>
        );
    }

    return (
        <Stack
            data-testid="inspector-details-item"
            sx={{
                ...panelSx,
                p: 1,
                columnGap: 1.5,
                rowGap: 0.5,
                ...sx
            }}
        >
            <Typography variant="h6" sx={{ gridArea: "name", lineHeight: 1.2 }}>
                {item.name}
            </Typography>
            <Box sx={{ gridArea: "description", minHeight: 0, overflow: "auto" }}>
                <DescriptionComponent description={item.description} />
            </Box>
        </Stack>
    );
}

export function ItemInspector({
    item,
    disabled = false,
    slotsInteractive = false,
    selectedSlotItemId = null,
    onSlotClick,
    onEmptySlotClick,
    getSlotMenuClick,
    getEmptySlotMenuClick,
    sx
}: ItemInspectorProps) {
    return (
        <Box
            data-testid="item-inspector"
            sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gridTemplateAreas: "'details contents'",
                overflowY: "auto",
                backgroundColor: "beige",
                borderRadius: 2,
                border: "1px black solid",
                boxSizing: "border-box",
                height: "100%",
                columnGap: 2,
                ...sx
            }}
        >
            <InspectorDetails item={item} sx={{ gridArea: "details" }} />
            <ItemContentSlots
                item={item}
                disabled={disabled}
                interactive={slotsInteractive}
                selectedSlotItemId={selectedSlotItemId}
                onSlotClick={onSlotClick}
                onEmptySlotClick={onEmptySlotClick}
                getSlotMenuClick={getSlotMenuClick}
                getEmptySlotMenuClick={getEmptySlotMenuClick}
                sx={{ gridArea: "contents" }}
            />
        </Box>
    );
}
