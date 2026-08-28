import Box from "@mui/material/Box";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ITilePos, TilePos } from "@atbs/maths";
import { UnitDeploymentWire, UnitId, UnitSummary } from "@atbs/shared-data";
import { useCallback, useLayoutEffect, useRef } from "react";
import { useWorld } from "../../hooks";
import { ImageComponent } from "../Image";
import type { DeploymentDragSource } from "./DeploymentPalette";

const DEFAULT_TILE_SIZE = 100;

function DeployedUnitOverlay({
    unit,
    deployment,
    tilePos,
    tileSize,
    disabled,
    onSelectUnit,
    onUndeploy
}: {
    unit: UnitSummary;
    deployment: UnitDeploymentWire;
    tilePos: ITilePos;
    tileSize: number;
    disabled: boolean;
    onSelectUnit?: (unitId: UnitId) => void;
    onUndeploy?: (unitId: UnitId) => void;
}) {
    const { world } = useWorld();
    const elementRef = useRef<HTMLDivElement | null>(null);
    const overlayId = `deployment-unit:${unit.id}`;

    const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
        id: `map-unit:${unit.id}`,
        data: { type: "map", unitId: unit.id } satisfies DeploymentDragSource,
        disabled
    });

    const setRefs = useCallback(
        (node: HTMLDivElement | null) => {
            setNodeRef(node);
            elementRef.current = node;
        },
        [setNodeRef]
    );

    useLayoutEffect(() => {
        world.registerAnchoredOverlay(overlayId, () => elementRef.current, new TilePos(tilePos), {
            anchor: "topLeft"
        });
        return () => {
            world.resumeAnchoredOverlay(overlayId);
            world.unregisterAnchoredOverlay(overlayId);
        };
    }, [world, overlayId, tilePos]);

    useLayoutEffect(() => {
        if (isDragging) {
            world.pauseAnchoredOverlay(overlayId);
        } else {
            world.resumeAnchoredOverlay(overlayId);
        }
    }, [isDragging, overlayId, world]);

    return (
        <Box
            ref={setRefs}
            data-testid={`deployed-unit-${unit.id}`}
            {...attributes}
            {...listeners}
            onClick={(event) => {
                event.stopPropagation();
                if (!disabled) {
                    onSelectUnit?.(unit.id);
                }
            }}
            onDoubleClick={(event) => {
                event.stopPropagation();
                if (!disabled) {
                    onUndeploy?.(unit.id);
                }
            }}
            style={
                transform
                    ? {
                          transform: CSS.Translate.toString(transform)
                      }
                    : undefined
            }
            sx={{
                position: "absolute",
                // Width/height are set by World to tileSize * zoom; keep a fallback for first paint.
                width: tileSize,
                height: tileSize,
                opacity: isDragging ? 0.85 : 1,
                cursor: disabled ? "default" : "grab",
                touchAction: "none",
                zIndex: isDragging ? 3 : 2,
                "&:active": disabled ? undefined : { cursor: "grabbing" },
                "& img": {
                    width: "100%",
                    height: "100%",
                    objectFit: "contain"
                }
            }}
        >
            {deployment.mapImage && (
                <ImageComponent images={deployment.mapImage} width={tileSize} height={tileSize} />
            )}
        </Box>
    );
}

export interface DeployedUnitOverlaysProps {
    units: UnitSummary[];
    unitDeployment: Record<UnitId, UnitDeploymentWire>;
    disabled?: boolean;
    onSelectUnit?: (unitId: UnitId) => void;
    onUndeploy?: (unitId: UnitId) => void;
}

export function DeployedUnitOverlays({
    units,
    unitDeployment,
    disabled = false,
    onSelectUnit,
    onUndeploy
}: DeployedUnitOverlaysProps) {
    const { world } = useWorld();
    const tileSize = world.hasMap ? world.map.tileSize : DEFAULT_TILE_SIZE;

    return (
        <>
            {units.map((unit) => {
                const deployment = unitDeployment[unit.id];
                if (!deployment?.location) {
                    return null;
                }
                return (
                    <DeployedUnitOverlay
                        key={unit.id}
                        unit={unit}
                        deployment={deployment}
                        tilePos={deployment.location}
                        tileSize={tileSize}
                        disabled={disabled}
                        onSelectUnit={onSelectUnit}
                        onUndeploy={onUndeploy}
                    />
                );
            })}
        </>
    );
}
