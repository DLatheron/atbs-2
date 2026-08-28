import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { ImageComponent } from "../Image";
import { Description, UnitDeploymentWire, UnitId, UnitSummary } from "@atbs/shared-data";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useInventoryTooltipDismissApi } from "../Inventory";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
    useDraggable,
    useDroppable,
    type DraggableAttributes,
    type DraggableSyntheticListeners
} from "@dnd-kit/core";
import { SxProps } from "@mui/material";
import { cutoutTextSx } from "../Inventory/styles";

const UNIT_TILE_SIZE = 100;
const UNIT_SELECTION_BORDER_COLOR = "#1e90ff";
const UNIT_SELECTION_BORDER_WIDTH = 3;
const UNIT_SELECTION_DASH_ARRAY = "90 90";
const UNIT_SELECTION_CHASE_DURATION_MS = 2000;
const PALETTE_GAP_PX = 8;
/** Tall enough to show at least four unit tiles (single column). */
const PALETTE_MAX_HEIGHT_PX = UNIT_TILE_SIZE * 4 + PALETTE_GAP_PX * 3;

export const DEPLOYMENT_PALETTE_ZONE_ID = "zone:palette";

export type DeploymentDragSource =
    | { type: "palette"; unitId: UnitId }
    | { type: "map"; unitId: UnitId };

export interface DeploymentPaletteProps {
    units: UnitSummary[];
    unitDeployment: Record<UnitId, UnitDeploymentWire>;
    selectedUnitId?: UnitId | null;
    disabled?: boolean;
    onSelectUnit?: (unitId: UnitId) => void;
    onDeployRandom?: (unitId: UnitId) => void;
    onUndeploy?: (unitId: UnitId) => void;
    sx?: SxProps;
}

interface UnitTileProps {
    unit: UnitSummary;
    deployed?: boolean;
    selected?: boolean;
    disabled?: boolean;
    tooltip?: boolean;
    draggable?: boolean;
    dragHandleAttributes?: DraggableAttributes;
    dragHandleListeners?: DraggableSyntheticListeners;
    isDragging?: boolean;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    onDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
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

function SelectionChaseBorder() {
    const inset = UNIT_SELECTION_BORDER_WIDTH / 2;
    const size = UNIT_TILE_SIZE - UNIT_SELECTION_BORDER_WIDTH;
    const period = UNIT_SELECTION_DASH_ARRAY.split(/\s+/)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .reduce((sum, n) => sum + n, 0);

    return (
        <Box
            component="svg"
            aria-hidden
            viewBox={`0 0 ${UNIT_TILE_SIZE} ${UNIT_TILE_SIZE}`}
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
                    animation: `inventorySelectionChase ${UNIT_SELECTION_CHASE_DURATION_MS}ms linear infinite`
                }
            }}
        >
            <rect
                x={inset}
                y={inset}
                width={size}
                height={size}
                fill="none"
                stroke={UNIT_SELECTION_BORDER_COLOR}
                strokeWidth={UNIT_SELECTION_BORDER_WIDTH}
                strokeDasharray={UNIT_SELECTION_DASH_ARRAY}
                strokeLinejoin="miter"
            />
        </Box>
    );
}

export function UnitTile({
    unit,
    deployed = false,
    selected = false,
    disabled = false,
    tooltip = true,
    draggable = false,
    dragHandleAttributes,
    dragHandleListeners,
    isDragging = false,
    onClick,
    onDoubleClick
}: UnitTileProps) {
    const tooltipBody = flattenDescription(unit.description);
    const dismissApi = useInventoryTooltipDismissApi();
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
            data-testid={`unit-tile-${unit.id}`}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            {...(draggable ? dragHandleAttributes : undefined)}
            {...(draggable ? dragHandleListeners : undefined)}
            sx={{
                position: "relative",
                width: UNIT_TILE_SIZE,
                height: UNIT_TILE_SIZE,
                backgroundColor: "transparent",
                p: 2,
                opacity: isDragging ? 0.4 : 1,
                cursor: disabled ? "default" : draggable ? "grab" : onClick ? "pointer" : "default",
                touchAction: draggable ? "none" : undefined,
                "&:active": draggable && !disabled ? { cursor: "grabbing" } : undefined
            }}
        >
            {selected && <SelectionChaseBorder />}
            <ImageComponent
                images={unit.uiImage}
                width={100}
                height={100}
                disabled={disabled || deployed}
            />
            {deployed && <Typography variant="body2" sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(45deg);", fontSize: "1.75rem", fontWeight: "bold", ...cutoutTextSx("211, 211, 211") }}>Deployed</Typography>}
        </Box>
    );

    if (!tooltip) {
        return tile;
    }

    return (
        <Tooltip
            title={
                <Box>
                    <Typography variant="subtitle2">{unit.name}</Typography>
                    {tooltipBody && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {tooltipBody}
                        </Typography>
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

function DraggablePaletteUnitTile({
    unit,
    deployed,
    selected,
    disabled,
    onSelectUnit,
    onDeployRandom,
    onUndeploy
}: {
    unit: UnitSummary;
    deployed: boolean;
    selected: boolean;
    disabled: boolean;
    onSelectUnit?: (unitId: UnitId) => void;
    onDeployRandom?: (unitId: UnitId) => void;
    onUndeploy?: (unitId: UnitId) => void;
}) {
    const canDrag = !disabled && !deployed;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `palette-unit:${unit.id}`,
        data: { type: "palette", unitId: unit.id } satisfies DeploymentDragSource,
        disabled: !canDrag
    });

    return (
        <Box ref={setNodeRef} sx={{ border: "1px solid #000" }}>
            <UnitTile
                unit={unit}
                deployed={deployed}
                selected={selected}
                disabled={disabled}
                draggable={canDrag}
                dragHandleAttributes={attributes}
                dragHandleListeners={listeners}
                isDragging={isDragging}
                onClick={() => onSelectUnit?.(unit.id)}
                onDoubleClick={() => {
                    if (disabled) {
                        return;
                    }
                    if (deployed) {
                        onUndeploy?.(unit.id);
                    } else {
                        onDeployRandom?.(unit.id);
                    }
                }}
            />
        </Box>
    );
}

export function DeploymentPalette({
    units,
    unitDeployment,
    selectedUnitId = null,
    disabled = false,
    onSelectUnit,
    onDeployRandom,
    onUndeploy,
    sx
}: DeploymentPaletteProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: DEPLOYMENT_PALETTE_ZONE_ID,
        data: { type: "palette-zone" },
        disabled
    });

    return (
        <Container
            ref={setNodeRef}
            data-testid="deployment-palette"
            disableGutters
            maxWidth={false}
            sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: `${PALETTE_GAP_PX}px`,
                justifyContent: "center",
                alignContent: "flex-start",
                outline: isOver ? `2px solid ${UNIT_SELECTION_BORDER_COLOR}` : undefined,
                outlineOffset: 4,
                borderRadius: 1,
                minHeight: UNIT_TILE_SIZE,
                maxHeight: PALETTE_MAX_HEIGHT_PX,
                overflowY: "auto",
                py: 0.5,
                ...sx
            }}
        >
            {units.map((unit) => (
                <DraggablePaletteUnitTile
                    key={unit.id}
                    unit={unit}
                    deployed={unitDeployment[unit.id]?.location != null}
                    selected={selectedUnitId === unit.id}
                    disabled={disabled}
                    onSelectUnit={onSelectUnit}
                    onDeployRandom={onDeployRandom}
                    onUndeploy={onUndeploy}
                />
            ))}
        </Container>
    );
}
