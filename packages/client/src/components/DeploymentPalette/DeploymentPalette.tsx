import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { ImageComponent } from "../Image";
import { Description, UnitId, UnitSummary } from "@atbs/shared-data";
import { useCallback, useEffect, useState } from "react";
import { useInventoryTooltipDismissApi } from "../Inventory";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ITilePos } from "@atbs/maths";

const UNIT_TILE_SIZE = 100;
const UNIT_SELECTION_BORDER_COLOR = "#1e90ff";
const UNIT_SELECTION_BORDER_WIDTH = 3;
const UNIT_SELECTION_DASH_ARRAY = "90 90";
const UNIT_SELECTION_CHASE_DURATION_MS = 2000;

export interface DeploymentPaletteProps {
    units: UnitSummary[];
    unitDeployment: Record<UnitId, ITilePos | null>;
}

interface UnitTileProps {
    unit: UnitSummary;
    deployed?: boolean;
    selected?: boolean;
    disabled?: boolean;
    tooltip?: boolean;
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

function UnitTile({
    unit,
    deployed = false,
    selected = false,
    disabled = false,
    tooltip = true
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
            sx={{
                width: UNIT_TILE_SIZE,
                height: UNIT_TILE_SIZE,
                border: "1px solid #000",
                backgroundColor: "white",
                p: 2
            }}
        >
            {selected && <SelectionChaseBorder />}
            <ImageComponent
                images={unit.uiImage}
                width={100}
                height={100}
                disabled={disabled || deployed}
            />
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

export function DeploymentPalette({ units, unitDeployment }: DeploymentPaletteProps) {
    return (
        <Container
            data-testid="deployment-palette"
            disableGutters
            maxWidth={false}
            sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                justifyContent: "center"
            }}
        >
            {units.map((unit) => (
                <UnitTile key={unit.id} unit={unit} deployed={unitDeployment[unit.id] !== null} />
            ))}
        </Container>
    );
}
