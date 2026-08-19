import type { InventoryItemView } from "@atbs/shared-data";
import { Box, IconButton, Stack, SxProps, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import type { MouseEvent } from "react";
import { DescriptionComponent } from "../Description";
import { ITEM_TILE_SIZE, ItemTile } from "./ItemTile";
import { collectContentSlots, slotLabel, type ContentSlotRef } from "./itemMenu";

const panelSx = {
    // borderRadius: 2,
    border: "1px black solid",
    backgroundColor: "beige",
    p: 1
} as const;

interface ItemContentSlotsProps {
    item: InventoryItemView | null;
    interactive?: boolean;
    getSlotMenuClick?: (
        owner: InventoryItemView,
        empty: boolean
    ) => ((event: MouseEvent<HTMLElement>) => void) | undefined;
    sx?: SxProps;
}

export interface ItemInspectorProps {
    item: InventoryItemView | null;
    /** When true, slot tiles expose load/unload menus. Defaults to read-only. */
    slotsInteractive?: boolean;
    getSlotMenuClick?: (
        owner: InventoryItemView,
        empty: boolean
    ) => ((event: MouseEvent<HTMLElement>) => void) | undefined;
    sx?: SxProps;
}

function ContentSlotTile({
    slotRef,
    interactive,
    getSlotMenuClick
}: {
    slotRef: ContentSlotRef;
    interactive: boolean;
    getSlotMenuClick?: ItemContentSlotsProps["getSlotMenuClick"];
}) {
    const { owner, slot } = slotRef;
    const contents = slot.contents;
    const empty = contents == null;
    const onMenuClick = interactive ? getSlotMenuClick?.(owner, empty) : undefined;

    return (
        <Box
            data-testid={
                empty
                    ? `empty-slot-${slot.slot}-${owner.id}`
                    : `content-slot-${slot.slot}-${owner.id}`
            }
            sx={{
                position: "relative",
                width: ITEM_TILE_SIZE,
                height: ITEM_TILE_SIZE,
                flexShrink: 0
            }}
        >
            {contents ? (
                <ItemTile item={contents} sx={{ width: "100%", height: "100%" }} />
            ) : (
                <Box
                    sx={{
                        boxSizing: "border-box",
                        width: "100%",
                        height: "100%",
                        // borderRadius: 1,
                        border: "1px dashed #666",
                        backgroundColor: "beige",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <Typography variant="caption" sx={{ color: "#666" }}>
                        {slotLabel(slot.slot)}
                    </Typography>
                </Box>
            )}
            {onMenuClick && (
                <IconButton
                    size="small"
                    aria-label="Slot actions"
                    data-testid={`slot-menu-${slot.slot}-${owner.id}`}
                    onClick={(event) => {
                        event.stopPropagation();
                        onMenuClick(event);
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
                    <MenuIcon sx={{ fontSize: 20 }} />
                </IconButton>
            )}
        </Box>
    );
}

function ItemContentSlots({
    item,
    interactive = false,
    getSlotMenuClick,
    sx
}: ItemContentSlotsProps) {
    const contentSlots = item ? collectContentSlots(item) : [];
    if (contentSlots.length === 0) {
        return null;
    }

    return (
        <Box
            data-testid="item-contents"
            sx={{
                p: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                ...sx
            }}
        >
            <Typography
                variant="subtitle2"
                sx={{ textAlign: "center", lineHeight: 1.2 }}
            >
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
                {contentSlots.map((slotRef) => (
                    <ContentSlotTile
                        key={`${slotRef.owner.id}-${slotRef.slot.slot}`}
                        slotRef={slotRef}
                        interactive={interactive}
                        getSlotMenuClick={getSlotMenuClick}
                    />
                ))}
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
    slotsInteractive = false,
    getSlotMenuClick,
    sx
}: ItemInspectorProps) {
    return (
        <Box
            data-testid="item-inspector"
            sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gridTemplateAreas: "'details contents'",
                height: "100%",
                columnGap: 2,
                ...sx
            }}
        >
            <InspectorDetails item={item} sx={{ gridArea: "details" }} />
            <ItemContentSlots
                item={item}
                interactive={slotsInteractive}
                getSlotMenuClick={getSlotMenuClick}
                sx={{ gridArea: "contents", gap: 1 }}
            />
        </Box>
    );
}
