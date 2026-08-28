import { Container, Typography } from "@mui/material";
import { useDeploymentPage } from "./useDeploymentPage";
import { useWorld } from "../../hooks";
import {
    CanvasLoopProps,
    DeploymentModePanel,
    MapComponent,
    SidePanel,
    TitleBarComponent,
    UnitSelectionOverlay
} from "../../components";
import {
    DeployedUnitOverlays,
    DEPLOYMENT_MAP_ZONE_ID,
    DEPLOYMENT_PALETTE_ZONE_ID,
    DeploymentDragSource,
    MapDropZone,
    UnitTile
} from "../../components/DeploymentPalette";
import { useCallback, useMemo, useState } from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import { TilePos, toTilePosString, Vec2 } from "@atbs/maths";
import { UnitId, UnitSummary } from "@atbs/shared-data";

export interface DeploymentPageProps {
    visible: boolean;
}

function dragSourceFromData(data: unknown): DeploymentDragSource | null {
    if (!data || typeof data !== "object") {
        return null;
    }
    const source = data as DeploymentDragSource;
    if ((source.type === "palette" || source.type === "map") && typeof source.unitId === "string") {
        return source;
    }
    return null;
}

function clientPointToTile(
    world: ReturnType<typeof useWorld>["world"],
    clientX: number,
    clientY: number
) {
    if (!world.hasMap) {
        return null;
    }
    const canvas = document.getElementById("main-map");
    if (!canvas) {
        return null;
    }
    const rect = canvas.getBoundingClientRect();
    const canvasPos = new Vec2(clientX - rect.x, clientY - rect.y);
    const worldPos = world.camera.canvasToWorld(canvasPos);
    return world.worldToTile(worldPos);
}

function dropTileFromDragEnd(world: ReturnType<typeof useWorld>["world"], event: DragEndEvent) {
    const activator = event.activatorEvent;
    if (!activator || !("clientX" in activator)) {
        return null;
    }
    return clientPointToTile(
        world,
        (activator as PointerEvent).clientX + (event.delta?.x ?? 0),
        (activator as PointerEvent).clientY + (event.delta?.y ?? 0)
    );
}

export function DeploymentPage({ visible }: DeploymentPageProps) {
    const statusBarHeight = 60;
    const statusBarHeightAndPadding = statusBarHeight + 2 * 8;

    const {
        side,
        disabled,
        units,
        unitDeployment,
        selectedUnitId,
        tileInfo,
        canEndDeployment,
        endDeploymentBlockedReasons,
        onEndDeploymentPhase,
        onDeploy,
        onUndeploy,
        onRedeploy,
        onDeployRandom,
        onDeployAll,
        onUndeployAll,
        onPreviousUnit,
        onNextUnit,
        onSelectUnit
    } = useDeploymentPage();

    const { world } = useWorld();
    const [activeDrag, setActiveDrag] = useState<{
        unit: UnitSummary;
        sourceType: DeploymentDragSource["type"];
    } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 }
        })
    );

    const unitsById = useMemo(() => {
        const map = new Map<UnitId, UnitSummary>();
        for (const unit of units) {
            map.set(unit.id, unit);
        }
        return map;
    }, [units]);

    const renderMap = useCallback(
        (props: CanvasLoopProps) => world.renderDeploymentPhase(props),
        [world]
    );

    const onMouseEnter = useCallback(
        (event: React.MouseEvent) => world?.onMouseEnter(event),
        [world]
    );
    const onMouseLeave = useCallback(
        (event: React.MouseEvent) => world?.onMouseLeave(event),
        [world]
    );
    const onMouseMove = useCallback(
        (event: React.MouseEvent) => world?.onMouseMove(event),
        [world]
    );
    const onMouseUp = useCallback((event: React.MouseEvent) => world?.onMouseUp(event), [world]);
    const onMouseDown = useCallback(
        (event: React.MouseEvent) => world?.onMouseDown(event),
        [world]
    );
    const onClick = useCallback((event: React.MouseEvent) => world?.onClick(event), [world]);
    const onDoubleClick = useCallback(
        (event: React.MouseEvent) => world?.onDoubleClick(event),
        [world]
    );
    const onWheel = useCallback((event: WheelEvent) => world?.onWheel(event), [world]);

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const source = dragSourceFromData(event.active.data.current);
            if (!source) {
                setActiveDrag(null);
                return;
            }
            const unit = unitsById.get(source.unitId);
            if (!unit) {
                setActiveDrag(null);
                return;
            }
            setActiveDrag({ unit, sourceType: source.type });
            onSelectUnit(source.unitId, { scrollToUnit: false });
        },
        [onSelectUnit, unitsById]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const source = dragSourceFromData(event.active.data.current);
            setActiveDrag(null);
            if (!source || disabled) {
                return;
            }

            const overId = event.over ? String(event.over.id) : null;

            if (overId === DEPLOYMENT_PALETTE_ZONE_ID && source.type === "map") {
                onUndeploy(source.unitId);
                return;
            }

            if (overId !== DEPLOYMENT_MAP_ZONE_ID) {
                return;
            }

            const tilePos = dropTileFromDragEnd(world, event);
            if (!tilePos || !world.hasDeploymentMarkers) {
                return;
            }

            const tilePosString = toTilePosString(tilePos);
            const zone = world.deploymentMarkers.find((marker) => marker.tiles.has(tilePosString));
            if (!zone) {
                return;
            }
            // Palette deploy cannot enter a full zone. Map redeploy may target a free
            // tile in a full zone because undeploy frees a slot first.
            if (zone.disabled && source.type === "palette") {
                return;
            }

            if (source.type === "palette") {
                onDeploy(source.unitId, tilePos);
                return;
            }

            // Map → map: optimistic tile update + undeploy/deploy (no home-tile flick).
            const current = unitDeployment[source.unitId]?.location;
            if (current && TilePos.IsEqual(current, tilePos)) {
                return;
            }
            onRedeploy(source.unitId, tilePos);
        },
        [disabled, onDeploy, onRedeploy, onUndeploy, unitDeployment, world]
    );

    const handleDragCancel = useCallback(() => {
        setActiveDrag(null);
    }, []);

    if (!visible) {
        return null;
    }

    return (
        <Container
            data-testid="action-page"
            maxWidth={false}
            sx={{
                m: 0,
                p: 0,
                width: "100vw",
                height: "100vh",
                display: "grid",
                gridTemplateAreas: `
                    'title-bar title-bar'
                    'map panel'
                `,
                gridTemplateColumns: "1fr 300px",
                gridTemplateRows: "auto 1fr"
            }}
            disableGutters
        >
            <TitleBarComponent
                sx={{
                    gridArea: "title-bar"
                }}
            >
                <Container
                    maxWidth={false}
                    disableGutters
                    sx={{
                        display: "grid",
                        gridTemplateAreas: "'title side turn' 'title vps turn'",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        columnGap: 3,
                        height: statusBarHeight
                    }}
                >
                    <Typography sx={{ m: "auto 0", gridArea: "title" }} variant="h4">
                        ATBS
                    </Typography>
                    <Typography sx={{ m: "auto", gridArea: "side" }} variant="h5">
                        Deploying: {side?.name ?? "-"}
                    </Typography>
                </Container>
            </TitleBarComponent>
            <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <MapComponent
                    renderMap={renderMap}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseDown={onMouseDown}
                    onClick={onClick}
                    onDoubleClick={onDoubleClick}
                    onWheel={onWheel}
                    sx={{ gridArea: "map" }}
                    disabled={disabled}
                >
                    <MapDropZone disabled={disabled} />
                    <DeployedUnitOverlays
                        units={units}
                        unitDeployment={unitDeployment}
                        disabled={disabled}
                        onSelectUnit={onSelectUnit}
                        onUndeploy={onUndeploy}
                    />
                    <UnitSelectionOverlay
                        tilePos={
                            selectedUnitId
                                ? (unitDeployment[selectedUnitId]?.location ?? null)
                                : null
                        }
                        visible={
                            !(
                                activeDrag?.sourceType === "map" &&
                                activeDrag.unit.id === selectedUnitId
                            )
                        }
                    />
                </MapComponent>
                <SidePanel
                    sx={{
                        gridArea: "panel",
                        height: `calc(100vh - ${statusBarHeightAndPadding}px)`
                    }}
                >
                    <DeploymentModePanel
                        visible
                        disabled={disabled}
                        units={units}
                        unitDeployment={unitDeployment}
                        selectedUnitId={selectedUnitId}
                        tileInfo={tileInfo}
                        canEndDeployment={canEndDeployment}
                        endDeploymentBlockedReasons={endDeploymentBlockedReasons}
                        onEndDeployment={onEndDeploymentPhase}
                        onSelectUnit={onSelectUnit}
                        onDeployRandom={onDeployRandom}
                        onUndeploy={onUndeploy}
                        onPreviousUnit={onPreviousUnit}
                        onNextUnit={onNextUnit}
                        onDeployAll={onDeployAll}
                        onUndeployAll={onUndeployAll}
                        sx={{ height: `calc(100vh - ${statusBarHeightAndPadding}px)` }}
                    />
                </SidePanel>
                {/* Palette drags use DragOverlay; map units drag in-place so grab offset stays correct. */}
                <DragOverlay dropAnimation={null} style={{ pointerEvents: "none", opacity: 0.75 }}>
                    {activeDrag?.sourceType === "palette" ? (
                        <UnitTile unit={activeDrag.unit} tooltip={false} />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </Container>
    );
}
