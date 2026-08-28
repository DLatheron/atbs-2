import { useCallback, useEffect, useRef, useState } from "react";
import { useServerMessageManager, useWorld } from "../../hooks";
import {
    ClientMap,
    DeploymentZoneSummaryWire,
    SideSummary,
    TileInfo,
    TrackingSpeed,
    UnitDeploymentWire,
    UnitId,
    UnitSummary
} from "@atbs/shared-data";
import { ITilePos, TilePos, toTilePosString, Vec2 } from "@atbs/maths";
import { allTilesFromWire } from "./deploymentZoneOverlay.js";

export function useDeploymentPage() {
    const { messageManager, sendMessage } = useServerMessageManager();
    const { world } = useWorld();
    const [map, setMap] = useState<ClientMap | null>(null);
    const [side, setSide] = useState<SideSummary | null>(null);
    const [units, setUnits] = useState<UnitSummary[]>([]);
    const [unitDeployment, setUnitDeployment] = useState<Record<UnitId, UnitDeploymentWire>>({});
    const [selectedUnitId, setSelectedUnitId] = useState<UnitId | null>(null);
    const [tileInfo, setTileInfo] = useState<TileInfo | null>(null);
    const [disabled /*, setDisabled*/] = useState<boolean>(false);
    const [canEndDeployment, setCanEndDeployment] = useState<boolean>(false);
    const [endDeploymentBlockedReason, setEndDeploymentBlockedReason] = useState<string | null>(
        null
    );
    // Expected final tile while undeploy+deploy are in flight — suppresses the
    // intermediate null from undeploy so the overlay does not flick home.
    const pendingRedeployRef = useRef<Map<UnitId, ITilePos>>(new Map());

    useEffect(() => {
        console.info("Mounting DeploymentPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:map", (_context, payload) => {
                console.info("$$$ Received map message $$$", payload.width, "x", payload.height);

                world.map = payload;
                setMap(payload);
            }),

            messageManager.registerHandler("server:deployment:side:start", (_context, payload) => {
                console.info("$$$ Received deployment side start message $$$", payload);

                setSide(payload.side);
                setUnits(payload.units);
                setSelectedUnitId((current) => current ?? payload.units[0]?.id ?? null);
            }),

            messageManager.registerHandler("server:deployment:markers", (_context, payload) => {
                console.info("$$$ Received deployment markers message $$$", payload);

                world.deploymentMarker = payload.marker;
                world.deploymentMarkers = payload.deploymentZones.map(
                    (deploymentZone: DeploymentZoneSummaryWire[0]) => ({
                        id: deploymentZone.id,
                        minUnits: deploymentZone.minUnits,
                        maxUnits: deploymentZone.maxUnits,
                        disabled: deploymentZone.disabled,
                        orientation: deploymentZone.orientation,
                        deployedCount: deploymentZone.deployedCount ?? 0,
                        outlineColor: deploymentZone.outlineColor,
                        tiles: new Set(
                            deploymentZone.tiles.map((tile: ITilePos) => toTilePosString(tile))
                        ),
                        allTiles: allTilesFromWire(deploymentZone.allTiles ?? deploymentZone.tiles)
                    })
                );

                const pending = pendingRedeployRef.current;
                setUnitDeployment((prev) => {
                    let units = payload.units;
                    if (pending.size > 0) {
                        units = { ...payload.units };
                        for (const [unitId, expectedTile] of pending) {
                            const serverEntry = units[unitId];
                            if (serverEntry?.location == null) {
                                units[unitId] = {
                                    location: expectedTile,
                                    orientation: prev[unitId]?.orientation,
                                    mapImage: prev[unitId]?.mapImage
                                };
                            } else {
                                pending.delete(unitId);
                            }
                        }
                    }
                    return units;
                });
                setCanEndDeployment(payload.canEndDeployment);
                setEndDeploymentBlockedReason(payload.endDeploymentBlockedReason);
            }),

            messageManager.registerHandler("server:camera:move:to", async (_context, payload) => {
                if (payload.target === "world") {
                    await new Promise<void>((resolve) =>
                        world.camera.interpolateToWorldPos(
                            new Vec2(payload.worldPos),
                            payload.trackingSpeed,
                            () => resolve()
                        )
                    );
                } else {
                    const worldPos = world.tileCenterToWorld(new TilePos(payload.tilePos));

                    await new Promise<void>((resolve) =>
                        world.camera.interpolateToWorldPos(
                            new Vec2(worldPos),
                            payload.trackingSpeed,
                            () => resolve()
                        )
                    );
                }
            }),

            messageManager.registerHandler("server:game:tile:info", (_context, payload) => {
                setTileInfo(payload);
            })
        ];

        return () => {
            console.info("Unmounting DeploymentPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, world]);

    const onEndDeploymentPhase = useCallback(() => {
        sendMessage({
            type: "client:deployment:end",
            payload: null
        });
    }, [sendMessage]);

    const onDeploy = useCallback(
        (unitId: UnitId, tilePos: ITilePos) => {
            setUnitDeployment((prev) => ({
                ...prev,
                [unitId]: { location: tilePos }
            }));
            sendMessage({
                type: "client:deployment:deploy",
                payload: { unitId, tilePos }
            });
        },
        [sendMessage]
    );

    const onUndeploy = useCallback(
        (unitId: UnitId) => {
            pendingRedeployRef.current.delete(unitId);
            setUnitDeployment((prev) => ({
                ...prev,
                [unitId]: { location: null }
            }));
            sendMessage({
                type: "client:deployment:undeploy",
                payload: { unitId }
            });
        },
        [sendMessage]
    );

    const onRedeploy = useCallback(
        (unitId: UnitId, tilePos: ITilePos) => {
            pendingRedeployRef.current.set(unitId, tilePos);
            // Snap the anchored overlay to the destination before drag teardown
            // paints, so resumeAnchoredOverlay does not flash the old tile.
            world.updateAnchoredOverlayTile(`deployment-unit:${unitId}`, new TilePos(tilePos));
            setUnitDeployment((prev) => ({
                ...prev,
                [unitId]: { location: tilePos, mapImage: prev[unitId]?.mapImage }
            }));
            sendMessage({
                type: "client:deployment:undeploy",
                payload: { unitId }
            });
            sendMessage({
                type: "client:deployment:deploy",
                payload: { unitId, tilePos }
            });
        },
        [sendMessage, world]
    );

    const onDeployRandom = useCallback(
        (unitId: UnitId) => {
            sendMessage({
                type: "client:deployment:deploy:random",
                payload: { unitId }
            });
        },
        [sendMessage]
    );

    const onDeployAll = useCallback(() => {
        pendingRedeployRef.current.clear();
        sendMessage({
            type: "client:deployment:deploy:all",
            payload: null
        });
    }, [sendMessage]);

    const onUndeployAll = useCallback(() => {
        pendingRedeployRef.current.clear();
        setUnitDeployment((prev) =>
            Object.fromEntries(
                Object.keys(prev).map((unitId) => [
                    unitId,
                    { location: null } satisfies UnitDeploymentWire
                ])
            )
        );
        sendMessage({
            type: "client:deployment:undeploy:all",
            payload: null
        });
    }, [sendMessage]);

    const onSelectUnit = useCallback(
        (unitId: UnitId, options?: { scrollToUnit?: boolean }) => {
            setSelectedUnitId(unitId);

            if (options?.scrollToUnit === false) {
                return;
            }

            const location = unitDeployment[unitId]?.location;
            if (location && world.hasMap) {
                const worldPos = world.tileCenterToWorld(new TilePos(location));
                world.camera.interpolateToWorldPos(new Vec2(worldPos), TrackingSpeed.enum.FAST);
            }
        },
        [unitDeployment, world]
    );

    const cycleSelectedUnit = useCallback(
        (direction: -1 | 1) => {
            if (units.length === 0) {
                return;
            }
            const currentIndex = selectedUnitId
                ? units.findIndex((unit) => unit.id === selectedUnitId)
                : -1;
            const nextIndex =
                currentIndex < 0 ? 0 : (currentIndex + direction + units.length) % units.length;
            const nextUnit = units[nextIndex];
            if (nextUnit) {
                onSelectUnit(nextUnit.id);
            }
        },
        [onSelectUnit, selectedUnitId, units]
    );

    const onPreviousUnit = useCallback(() => cycleSelectedUnit(-1), [cycleSelectedUnit]);
    const onNextUnit = useCallback(() => cycleSelectedUnit(1), [cycleSelectedUnit]);

    return {
        map,
        side,
        units,
        unitDeployment,
        selectedUnitId,
        tileInfo,
        disabled,
        canEndDeployment,
        endDeploymentBlockedReason,
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
    };
}
