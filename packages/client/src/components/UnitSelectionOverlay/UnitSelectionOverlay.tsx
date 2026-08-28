import Box from "@mui/material/Box";
import { ITilePos, TilePos } from "@atbs/maths";
import { useLayoutEffect, useRef } from "react";
import { useWorld } from "../../hooks";
import { World } from "../../World";

export const UNIT_SELECTION_BORDER_COLOR = "#1e90ff";
export const UNIT_SELECTION_BORDER_WIDTH = 3;
export const UNIT_SELECTION_DASH_ARRAY = "90 90";
export const UNIT_SELECTION_CHASE_DURATION_MS = 2000;

const DEFAULT_TILE_SIZE = 100;

function SelectionChaseBorder({ size }: { size: number }) {
    const inset = UNIT_SELECTION_BORDER_WIDTH / 2;
    const rectSize = size - UNIT_SELECTION_BORDER_WIDTH;
    const period = UNIT_SELECTION_DASH_ARRAY.split(/\s+/)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .reduce((sum, n) => sum + n, 0);

    return (
        <Box
            component="svg"
            aria-hidden
            viewBox={`0 0 ${size} ${size}`}
            sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 2,
                overflow: "visible",
                "@keyframes unitSelectionChase": {
                    to: {
                        strokeDashoffset: -period
                    }
                },
                "& > rect": {
                    animation: `unitSelectionChase ${UNIT_SELECTION_CHASE_DURATION_MS}ms linear infinite`
                }
            }}
        >
            <rect
                x={inset}
                y={inset}
                width={rectSize}
                height={rectSize}
                fill="none"
                stroke={UNIT_SELECTION_BORDER_COLOR}
                strokeWidth={UNIT_SELECTION_BORDER_WIDTH}
                strokeDasharray={UNIT_SELECTION_DASH_ARRAY}
                strokeLinejoin="miter"
            />
        </Box>
    );
}

export interface UnitSelectionOverlayProps {
    tilePos: ITilePos | null | undefined;
    /** When false, the overlay is unregistered (e.g. while dragging that unit). */
    visible?: boolean;
}

/**
 * Chasing selection ring anchored to a map tile (same World overlay path as the action menu).
 */
export function UnitSelectionOverlay({ tilePos, visible = true }: UnitSelectionOverlayProps) {
    const { world } = useWorld();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const tileSize = world.hasMap ? world.map.tileSize : DEFAULT_TILE_SIZE;
    const show = visible && !!tilePos;

    useLayoutEffect(() => {
        if (!show || !tilePos) {
            world.unregisterAnchoredOverlay(World.UNIT_SELECTION_OVERLAY_ID);
            return;
        }

        world.registerAnchoredOverlay(
            World.UNIT_SELECTION_OVERLAY_ID,
            () => elementRef.current,
            new TilePos(tilePos)
            // default center + scale(zoom), matching the action menu
        );

        return () => {
            world.unregisterAnchoredOverlay(World.UNIT_SELECTION_OVERLAY_ID);
        };
    }, [world, show, tilePos?.col, tilePos?.row]);

    useLayoutEffect(() => {
        if (show && tilePos) {
            world.updateAnchoredOverlayTile(World.UNIT_SELECTION_OVERLAY_ID, new TilePos(tilePos));
        }
    }, [world, show, tilePos?.col, tilePos?.row]);

    if (!show || !tilePos) {
        return null;
    }

    return (
        <Box
            ref={elementRef}
            data-testid="unit-selection-overlay"
            sx={{
                pointerEvents: "none",
                position: "absolute",
                width: tileSize,
                height: tileSize,
                // left/top/transform set by World (center + scale)
                zIndex: 4
            }}
        >
            <SelectionChaseBorder size={tileSize} />
        </Box>
    );
}
