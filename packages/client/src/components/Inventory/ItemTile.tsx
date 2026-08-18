import type { Description, InventoryItemView } from "@atbs/shared-data";
import { Box, IconButton, SxProps, Tooltip, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import MenuIcon from "@mui/icons-material/Menu";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { MouseEvent, ReactNode, SyntheticEvent } from "react";
import { ImageComponent } from "../Image";
import { collectAmmoCounts, formatAmmoCount } from "./itemMenu";

/** Sized so an image plus up to three ammo counts fit on the square. */
export const ITEM_TILE_SIZE = 180;
const MAX_AMMO_COUNTS = 3;

export interface ItemTileProps {
    item: InventoryItemView;
    selected?: boolean;
    disabled?: boolean;
    draggable?: boolean;
    dragHandleAttributes?: DraggableAttributes;
    dragHandleListeners?: DraggableSyntheticListeners;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    onMenuClick?: (event: MouseEvent<HTMLElement>) => void;
    sx?: SxProps;
}

function flattenDescription(description: Description): string {
    return description
        .map((entry) => {
            if ("text" in entry) {
                return entry.text;
            }
            if ("h1" in entry) {
                return entry.h1;
            }
            if ("h2" in entry) {
                return entry.h2;
            }
            if ("h3" in entry) {
                return entry.h3;
            }
            return "";
        })
        .filter(Boolean)
        .join(" ");
}

function TileBadge({ children, sx }: { children: ReactNode; sx?: SxProps }) {
    return (
        <Box
            sx={{
                position: "absolute",
                minWidth: 18,
                px: 0.5,
                py: 0.1,
                borderRadius: 0.5,
                bgcolor: "rgba(0, 0, 0, 0.7)",
                color: "white",
                fontSize: "0.7rem",
                lineHeight: 1.2,
                textAlign: "center",
                pointerEvents: "none",
                ...sx
            }}
        >
            {children}
        </Box>
    );
}

function stopTileChromePointer(event: SyntheticEvent) {
    event.stopPropagation();
}

export function ItemTile({
    item,
    selected = false,
    disabled = false,
    draggable = false,
    dragHandleAttributes,
    dragHandleListeners,
    onClick,
    onMenuClick,
    sx
}: ItemTileProps) {
    const ammoCounts = collectAmmoCounts(item).slice(0, MAX_AMMO_COUNTS);
    const tooltipBody = flattenDescription(item.description);

    return (
        <Tooltip
            title={
                <Box>
                    <Typography variant="subtitle2">{item.name}</Typography>
                    {tooltipBody && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {tooltipBody}
                        </Typography>
                    )}
                </Box>
            }
            placement="top"
            enterDelay={400}
        >
            <Box
                data-testid={`item-tile-${item.id}`}
                onClick={disabled ? undefined : onClick}
                sx={{
                    boxSizing: "border-box",
                    position: "relative",
                    width: ITEM_TILE_SIZE,
                    height: ITEM_TILE_SIZE,
                    borderRadius: 1,
                    aspectRatio: 1,
                    border: selected ? "2px solid #333" : "1px solid #000",
                    backgroundColor: "beige",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: disabled ? "default" : onClick ? "pointer" : "default",
                    opacity: disabled ? 0.5 : 1,
                    p: 0.5,
                    pt: 2,
                    pb: 2.25,
                    ...sx
                }}
            >
                {draggable && (
                    <Box
                        component="span"
                        {...dragHandleAttributes}
                        {...dragHandleListeners}
                        onClick={stopTileChromePointer}
                        sx={{
                            position: "absolute",
                            top: 2,
                            left: 2,
                            zIndex: 1,
                            display: "flex",
                            cursor: disabled ? "default" : "grab",
                            color: "#666",
                            touchAction: "none",
                            "&:active": { cursor: disabled ? "default" : "grabbing" }
                        }}
                        aria-label="Reorder"
                    >
                        <DragIndicatorIcon sx={{ fontSize: 20 }} />
                    </Box>
                )}
                {onMenuClick && !disabled && (
                    <IconButton
                        size="small"
                        aria-label="Item actions"
                        data-testid={`item-menu-${item.id}`}
                        onClick={(event) => {
                            stopTileChromePointer(event);
                            onMenuClick(event);
                        }}
                        onPointerDown={stopTileChromePointer}
                        onPointerUp={stopTileChromePointer}
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
                <ImageComponent images={item.uiImage} width={100} height={100} disabled={disabled} />
                {item.quantity > 1 && (
                    <TileBadge sx={{ top: 2, left: draggable ? 18 : 2 }}>{item.quantity}</TileBadge>
                )}
                {ammoCounts.length > 0 && (
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: 2,
                            left: 2,
                            right: 2,
                            display: "flex",
                            justifyContent: "center",
                            gap: 0.25,
                            pointerEvents: "none"
                        }}
                    >
                        {ammoCounts.map((count, index) => (
                            <Box
                                key={index}
                                sx={{
                                    minWidth: 32,
                                    flex: "1 1 0",
                                    maxWidth: "33%",
                                    px: 0,
                                    py: 0.5,
                                    borderRadius: 1,
                                    bgcolor: "rgba(0, 0, 0, 0.7)",
                                    color: "white",
                                    fontSize: "0.8rem",
                                    lineHeight: 1.1,
                                    textAlign: "center"
                                }}
                            >
                                {formatAmmoCount(count)}
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
        </Tooltip>
    );
}
