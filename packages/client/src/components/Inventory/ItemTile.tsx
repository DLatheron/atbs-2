import { DEFAULT_CURRENCY, type Description, type InventoryItemView } from "@atbs/shared-data";
import { Box, IconButton, SxProps, Tooltip, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type ReactNode,
    type SyntheticEvent
} from "react";
import { ImageComponent } from "../Image";
import { collectAmmoCounts, describeItemContents, formatAmmoCount, formatMoney } from "./itemMenu";
import {
    ITEM_SELECTION_BORDER_COLOR,
    ITEM_SELECTION_BORDER_WIDTH,
    ITEM_SELECTION_CHASE_DURATION_MS,
    ITEM_SELECTION_DASH_ARRAY
} from "./styles";

/** Sized so an image plus up to three ammo counts fit on the square. */
export const ITEM_TILE_SIZE = 180;
const MAX_AMMO_COUNTS = 3;

interface TooltipDismissApi {
    subscribe: (listener: () => void) => () => void;
    dismiss: () => void;
}

const TooltipDismissContext = createContext<TooltipDismissApi | null>(null);

export function InventoryTooltipDismissProvider({ children }: { children: ReactNode }) {
    const listenersRef = useRef(new Set<() => void>());
    const api = useMemo<TooltipDismissApi>(
        () => ({
            subscribe: (listener) => {
                listenersRef.current.add(listener);
                return () => {
                    listenersRef.current.delete(listener);
                };
            },
            dismiss: () => {
                listenersRef.current.forEach((listener) => listener());
            }
        }),
        []
    );

    return <TooltipDismissContext.Provider value={api}>{children}</TooltipDismissContext.Provider>;
}

export function useDismissInventoryTooltips(): () => void {
    const api = useContext(TooltipDismissContext);
    return api?.dismiss ?? (() => undefined);
}

export interface ItemTileProps {
    item: InventoryItemView;
    selected?: boolean;
    disabled?: boolean;
    draggable?: boolean;
    dragHandleAttributes?: DraggableAttributes;
    dragHandleListeners?: DraggableSyntheticListeners;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    onMenuClick?: (event: MouseEvent<HTMLElement>) => void;
    /** When false, the tile has no hover tooltip. Defaults to true. */
    tooltip?: boolean;
    /** Shop price for one purchase, shown in the tooltip. */
    cost?: number;
    /** How many units one purchase yields, when more than one. */
    batchSize?: number;
    /** Currency symbol the owning store trades in. */
    currency?: string;
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
                // borderRadius: 0.5,
                bgcolor: "rgba(0, 0, 0, 0.7)",
                color: "white",
                fontSize: "0.8rem",
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

function SelectionChaseBorder() {
    const inset = ITEM_SELECTION_BORDER_WIDTH / 2;
    const size = ITEM_TILE_SIZE - ITEM_SELECTION_BORDER_WIDTH;
    const period = ITEM_SELECTION_DASH_ARRAY.split(/\s+/)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .reduce((sum, n) => sum + n, 0);

    return (
        <Box
            component="svg"
            aria-hidden
            viewBox={`0 0 ${ITEM_TILE_SIZE} ${ITEM_TILE_SIZE}`}
            sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 2,
                overflow: "visible",
                "@keyframes inventorySelectionChase": {
                    to: {
                        strokeDashoffset: -period
                    }
                },
                "& > rect": {
                    animation: `inventorySelectionChase ${ITEM_SELECTION_CHASE_DURATION_MS}ms linear infinite`
                }
            }}
        >
            <rect
                x={inset}
                y={inset}
                width={size}
                height={size}
                fill="none"
                stroke={ITEM_SELECTION_BORDER_COLOR}
                strokeWidth={ITEM_SELECTION_BORDER_WIDTH}
                strokeDasharray={ITEM_SELECTION_DASH_ARRAY}
                strokeLinejoin="miter"
            />
        </Box>
    );
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
    tooltip = true,
    cost,
    batchSize = 1,
    currency = DEFAULT_CURRENCY,
    sx
}: ItemTileProps) {
    const ammoCounts = collectAmmoCounts(item).slice(0, MAX_AMMO_COUNTS);
    const tooltipBody = flattenDescription(item.description);
    const contentLines = describeItemContents(item);
    const dismissApi = useContext(TooltipDismissContext);
    const [tooltipOpen, setTooltipOpen] = useState(false);

    useEffect(() => {
        if (!dismissApi) {
            return;
        }

        return dismissApi.subscribe(() => {
            setTooltipOpen((open) => (open ? false : open));
        });
    }, [dismissApi]);

    const handleTooltipOpen = useCallback(() => setTooltipOpen(true), []);
    const handleTooltipClose = useCallback(() => setTooltipOpen(false), []);

    const tile = (
        <Box
            data-testid={`item-tile-${item.id}`}
            onClick={disabled ? undefined : onClick}
            {...(draggable ? dragHandleAttributes : undefined)}
            {...(draggable ? dragHandleListeners : undefined)}
            sx={{
                boxSizing: "border-box",
                position: "relative",
                width: ITEM_TILE_SIZE,
                height: ITEM_TILE_SIZE,
                // borderRadius: 1,
                aspectRatio: 1,
                border: "1px solid #000",
                backgroundColor: "white",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: disabled ? "default" : draggable ? "grab" : onClick ? "pointer" : "default",
                touchAction: draggable ? "none" : undefined,
                "&:active": draggable && !disabled ? { cursor: "grabbing" } : undefined,
                opacity: disabled ? 0.5 : 1,
                p: 0.5,
                pt: 2,
                pb: 2.25,
                ...sx
            }}
        >
            {selected && <SelectionChaseBorder />}
            {onMenuClick && (
                <IconButton
                    size="small"
                    aria-label="Item actions"
                    data-testid={`item-menu-${item.id}`}
                    disabled={disabled}
                    onClick={(event) => {
                        stopTileChromePointer(event);
                        if (!disabled) {
                            onMenuClick(event);
                        }
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
            {item.quantity > 1 && <TileBadge sx={{ top: 2, left: 2 }}>x{item.quantity}</TileBadge>}
            {ammoCounts.length > 0 && (
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 4,
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
                                // borderRadius: 1,
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
    );

    if (!tooltip) {
        return tile;
    }

    return (
        <Tooltip
            title={
                <Box>
                    <Typography variant="subtitle2">{item.name}</Typography>
                    {cost !== undefined && (
                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                            {batchSize > 1
                                ? `${batchSize} for ${formatMoney(cost, currency)}`
                                : formatMoney(cost, currency)}
                        </Typography>
                    )}
                    {tooltipBody && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {tooltipBody}
                        </Typography>
                    )}
                    {contentLines.length > 0 && (
                        <Box sx={{ mt: 0.5 }}>
                            {contentLines.map((line, index) => (
                                <Typography
                                    key={index}
                                    variant="body2"
                                    sx={{ pl: line.depth, lineHeight: 1.4 }}
                                >
                                    {line.text}
                                </Typography>
                            ))}
                        </Box>
                    )}
                </Box>
            }
            placement="top"
            enterDelay={400}
            leaveDelay={0}
            disableInteractive
            open={dismissApi ? tooltipOpen : undefined}
            onOpen={handleTooltipOpen}
            onClose={handleTooltipClose}
            slotProps={{
                transition: { timeout: 200 }
            }}
        >
            {tile}
        </Tooltip>
    );
}
