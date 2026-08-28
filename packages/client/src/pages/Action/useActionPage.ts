import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServerMessageManager, useWorld } from "../../hooks";
import {
    ClientMap,
    ErrorType,
    FireDetails,
    FireMode,
    FireModeItemSummary,
    FireSelector,
    InventorySnapshot,
    ItemId,
    OnTarget,
    Prime,
    RenderMode,
    SideSummary,
    ThrowDetails,
    TileInfo,
    TrackingSpeed,
    UnitActionType,
    UnitSummary
} from "@atbs/shared-data";
import { Orientation, TilePos, Vec2 } from "@atbs/maths";
import { MapMode } from "../../MapMode";
import { selectiveMerge } from "../../helpers/selectiveMerge";
import { fadeInElement, spawnFadingGhost } from "../../utils/ghostOverlay";
import { World } from "../../World";

function delay(delayInMs: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, delayInMs));
}

let actionMenuGhostId = 0;

export function useActionPage() {
    const actionMenuRef = useRef<HTMLDivElement | null>(null);
    const unitActionModeRef = useRef(false);
    const inventoryOpenRef = useRef(false);

    const { messageManager, sendMessage } = useServerMessageManager();
    const { world } = useWorld();
    const [sidePanelMode, setSidePanelMode] = useState<MapMode>(MapMode.enum["map-mode"]);
    const [side, setSide] = useState<SideSummary | null>(null);
    const [turn, setTurn] = useState<number>(0);
    const [map, setMap] = useState<ClientMap | null>(null);
    const [unit, setUnit] = useState<UnitSummary | null>(null);
    const [unitWeapon, setUnitWeapon] = useState<FireModeItemSummary | null>(null);
    const [tileInfo, setTileInfo] = useState<TileInfo | null>(null);
    const [error, setError] = useState<ErrorType | null>(null);
    const [disabled, setDisabled] = useState<boolean>(false);
    const [isOnTarget, setIsOnTarget] = useState<OnTarget>(OnTarget.enum.none);
    const [opportunityFire, setOpportunityFire] = useState<string | undefined>();
    const [unitActionMode, setUnitActionMode] = useState<boolean>(false);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [inventorySnapshot, setInventorySnapshot] = useState<InventorySnapshot | null>(null);

    unitActionModeRef.current = unitActionMode;
    inventoryOpenRef.current = inventoryOpen;

    const spawnActionMenuGhost = useCallback(() => {
        const source = actionMenuRef.current;
        const tilePos = world.actionMenuTilePos;
        if (!source?.parentElement || !tilePos) {
            return;
        }

        const frozenTile = new TilePos(tilePos);
        const overlayId = `action-menu-ghost-${++actionMenuGhostId}`;

        spawnFadingGhost({
            source,
            container: source.parentElement,
            onMount: (ghost) => {
                world.registerAnchoredOverlay(overlayId, () => ghost, frozenTile);
            },
            onUnmount: () => {
                world.unregisterAnchoredOverlay(overlayId);
            }
        });

        // Stop repositioning the live menu so it does not jump before React unmounts/remounts it.
        world.unregisterAnchoredOverlay(World.ACTION_MENU_OVERLAY_ID);
    }, [world]);

    useEffect(() => {
        console.info("Mounting ActionPage Message Handlers");

        world.deploymentMarkers = null;

        const handlerHandles = [
            messageManager.registerHandler("server:map", (_context, payload) => {
                console.info("$$$ Received map message $$$", payload.width, "x", payload.height);

                world.map = payload;
                setMap(payload);
            }),

            messageManager.registerHandler("server:unit:mode:move", async (_context, unit) => {
                console.info("$$$ Received unit message $$$", unit?.id);

                if (unitActionModeRef.current && actionMenuRef.current) {
                    spawnActionMenuGhost();
                }

                setUnit(unit);
                world.unit = unit;
                if (unit) {
                    setSidePanelMode(MapMode.enum["unit-mode"]);
                    world.mapMode = MapMode.enum["unit-mode"];
                } else {
                    setSidePanelMode(MapMode.enum["map-mode"]);
                    world.mapMode = MapMode.enum["map-mode"];
                }

                if (unit) {
                    const worldPos = world.tileCenterToWorld(new TilePos(unit.location));

                    await new Promise<void>((resolve) =>
                        world.camera.interpolateToWorldPos(
                            new Vec2(worldPos),
                            TrackingSpeed.enum.FAST,
                            () => resolve()
                        )
                    );
                }
            }),

            messageManager.registerHandler("server:unit:mode:fire", (_context, payload) => {
                console.info("$$$ Received unit message $$$", payload?.id);

                setUnitWeapon(payload);
                world.unitWeapon = payload;
                world.throwing = false;
                if (payload) {
                    setSidePanelMode(MapMode.enum["fire-mode"]);
                    world.mapMode = MapMode.enum["fire-mode"];
                } else {
                    setSidePanelMode(MapMode.enum["map-mode"]);
                    world.mapMode = MapMode.enum["map-mode"];
                }
            }),

            messageManager.registerHandler("server:unit:mode:fire:end", () => {
                setSidePanelMode(MapMode.enum["unit-mode"]);
                world.mapMode = MapMode.enum["unit-mode"];
            }),

            messageManager.registerHandler("server:turn:start", (_context, payload) => {
                setTurn(payload.turn);
            }),

            messageManager.registerHandler("server:side:start", (_context, payload) => {
                setSide(payload.side);
                setUnit(null);
                setUnitWeapon(null);
                setTileInfo(null);
                setSidePanelMode(MapMode.enum["map-mode"]);
                world.mapMode = MapMode.enum["map-mode"];
            }),

            messageManager.registerHandler("server:game:tile:info", (_context, payload) => {
                setTileInfo(payload);
            }),

            messageManager.registerHandler("server:wait:time", async (_context, payload) => {
                await delay(payload);
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

            messageManager.registerHandler("server:map:update", (_context, payload) => {
                setMap((map: ClientMap | null) => {
                    if (!map) {
                        return null;
                    }

                    for (const update of payload) {
                        const tilePos = new TilePos(update.tilePos);

                        map.tilesByRenderMode[RenderMode.enum.MAP_MODE][tilePos.row][tilePos.col] =
                            update.tileByRenderMode[RenderMode.enum.MAP_MODE];
                        map.tilesByRenderMode[RenderMode.enum.FIRE_MODE][tilePos.row][tilePos.col] =
                            update.tileByRenderMode[RenderMode.enum.FIRE_MODE];
                    }

                    return map;
                });
            }),

            messageManager.registerHandler("server:unit:selected:update", (_context, payload) => {
                const fieldModes = {
                    unitActionGrid: "replace",
                    itemInUse: "replace",
                    description: "replace",
                    uiImage: "replace"
                } as const;
                setUnit((unit: UnitSummary | null) =>
                    unit ? selectiveMerge(unit, payload, fieldModes) : null
                );
                world.unit = selectiveMerge(world.unit, payload, fieldModes);

                if (world.unit.itemInUse === null) {
                    setSidePanelMode(MapMode.enum["unit-mode"]);
                    world.mapMode = MapMode.enum["map-mode"];
                    setUnitWeapon(null);
                    world.unitWeapon = null;
                }
            }),

            messageManager.registerHandler("server:unit:weapon:update", (_context, payload) => {
                const fieldModes = {
                    description: "replace",
                    weapons: "replace",
                    uiImage: "replace"
                } as const;
                setUnitWeapon((weap: FireModeItemSummary | null) =>
                    weap ? selectiveMerge(weap, payload, fieldModes) : null
                );
                world.unitWeapon = selectiveMerge(world.unitWeapon, payload, fieldModes);
            }),

            messageManager.registerHandler("server:error", (_context, error) => {
                setError(error);
            }),

            messageManager.registerHandler("server:ui:disabled", (_context, disabled) => {
                setDisabled(disabled);
            }),

            messageManager.registerHandler("server:fire:trace", async (_context, payload) => {
                let resolver: (value: unknown) => void;
                const block = new Promise((resolve) => (resolver = resolve));

                setIsOnTarget(payload.isOnTarget);
                await world.setTracers(
                    payload.tracers,
                    payload.tileUpdates,
                    payload.deaths,
                    payload.hitSparks,
                    () => {
                        setMap((map: ClientMap | null) => map);
                    },
                    () => {
                        setIsOnTarget(OnTarget.enum.none);
                        resolver(undefined);
                    },
                    payload.animations,
                    {
                        animObjects: payload.animObjects,
                        animObjectRemovals: payload.animObjectRemovals,
                        visibilityUpdates: payload.visibilityUpdates
                    }
                );

                console.info("!!! Queue blocked");
                await block;
                console.info(">>> Queue unblocked");
            }),

            messageManager.registerHandler("server:debug:graphics", async (_context, payload) => {
                world.debugGraphics = payload;
            }),

            messageManager.registerHandler("server:visible:tiles", async (_context, payload) => {
                world.visibleTiles = new Set(payload.tiles);
                world.visibilityViewers = payload.viewers;
            }),

            messageManager.registerHandler("server:animations:play", async (_context, payload) => {
                for (const playAnimation of payload) {
                    world.animationController.newAnimation(playAnimation);
                }
            }),

            messageManager.registerHandler(
                "server:anim:objects:create",
                async (_context, payload) => {
                    for (const animatableObjectRecipe of payload) {
                        world.animationController.newAnimatableObject(animatableObjectRecipe);
                    }
                }
            ),

            messageManager.registerHandler(
                "server:anim:objects:remove",
                async (_context, payload) => {
                    for (const instanceId of payload) {
                        world.animationController.removeAnimatableObject(instanceId);
                        world.animationController.removeAnimation(instanceId);
                    }
                }
            ),

            // messageManager.registerHandler("server:opportunity:fire", async (_context, payload) => {
            //     console.info("$$$ Received opportunity fire message $$$", payload.unit.id);

            //     await delay(5000);
            // }),

            messageManager.registerHandler(
                "server:opportunity:fire:start",
                async (_context, payload) => {
                    setOpportunityFire(payload.unit.name);
                }
            ),

            messageManager.registerHandler("server:opportunity:fire:end", async () => {
                setOpportunityFire(undefined);
            }),

            messageManager.registerHandler("server:unit:inventory", (_context, payload) => {
                if (inventoryOpenRef.current) {
                    setInventorySnapshot(payload);
                }
                setDisabled(false);
            })
        ];

        return () => {
            console.info("Unmounting ActionPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, sendMessage, world, spawnActionMenuGhost]);

    const onMove = useCallback(
        (orientation: Orientation) => {
            if (unit?.id) {
                setDisabled(true);
                sendMessage({
                    type: "client:unit:move",
                    payload: {
                        unitId: unit.id,
                        orientation
                    }
                });
            }
        },
        [sendMessage, unit?.id]
    );

    const onRotateTo = useCallback(
        (orientation: Orientation) => {
            if (unit?.id) {
                setDisabled(true);
                sendMessage({
                    type: "client:unit:rotate",
                    payload: {
                        unitId: unit.id,
                        orientation
                    }
                });
            }
        },
        [sendMessage, unit?.id]
    );

    const onEndMovement = useCallback(() => {
        if (unit?.id) {
            sendMessage({
                type: "client:unit:move:end",
                payload: unit.id
            });
        }
    }, [sendMessage, unit?.id]);

    const onEndTurn = useCallback(() => {
        sendMessage({
            type: "client:game:turn:end",
            payload: null
        });
    }, [sendMessage]);

    const onEndError = useCallback(() => {
        setError(null);
    }, []);

    const onFireMode = useCallback(() => {
        if (unit?.id) {
            sendMessage({
                type: "client:unit:mode:fire",
                payload: unit.id
            });
        }
    }, [sendMessage, unit?.id]);

    const onEndFireMode = useCallback(() => {
        sendMessage({
            type: "client:unit:mode:fire:end",
            payload: null
        });
    }, [sendMessage]);

    const onChangeFireSelector = useCallback(
        (weaponId: ItemId, fireSelector: FireSelector) => {
            if (unit?.id) {
                sendMessage({
                    type: "client:unit:fire:selector",
                    payload: {
                        unitId: unit.id,
                        weaponId,
                        fireSelector
                    }
                });
            }
        },
        [sendMessage, unit?.id]
    );

    const onChangeFireMode = useCallback(
        (fireMode: FireMode) => {
            if (unit?.id) {
                sendMessage({
                    type: "client:unit:fire:mode",
                    payload: {
                        unitId: unit.id,
                        fireMode
                    }
                });
            }
        },
        [sendMessage, unit?.id]
    );

    const onChangeWeaponIndex = useCallback(
        (weaponIndex: number) => {
            if (unit?.id) {
                sendMessage({
                    type: "client:unit:weapon:index",
                    payload: {
                        unitId: unit.id,
                        weaponIndex
                    }
                });
            }
        },
        [sendMessage, unit?.id]
    );

    const onFire = useCallback(
        (details: FireDetails) => {
            if (disabled) {
                return;
            }

            setDisabled(true);

            sendMessage({
                type: "client:unit:fire",
                payload: details
            });
        },
        [disabled, sendMessage]
    );

    useEffect(() => {
        world.fireCallback = onFire;
    }, [world, onFire]);

    const onThrow = useCallback(
        (details: ThrowDetails) => {
            if (disabled) {
                return;
            }

            setDisabled(true);

            sendMessage({
                type: "client:unit:throw",
                payload: details
            });
        },
        [disabled, sendMessage]
    );

    useEffect(() => {
        world.throwCallback = onThrow;
    }, [world, onThrow]);

    const nextUnit = useCallback(() => {
        sendMessage({
            type: "client:game:unit:next",
            payload: null
        });
    }, [sendMessage]);

    const onAction = useCallback(
        (action: UnitActionType, orientation: Orientation) => {
            if (unit?.id) {
                setDisabled(true);
                sendMessage({
                    type: "client:unit:action",
                    payload: {
                        unitId: unit.id,
                        action,
                        orientation
                    }
                });
            }
        },
        [sendMessage, unit?.id]
    );

    const onUnitActionMode = useCallback(
        (selected: boolean) => {
            if (!selected && unitActionModeRef.current && actionMenuRef.current) {
                spawnActionMenuGhost();
            }
            setUnitActionMode(selected);
        },
        [spawnActionMenuGhost]
    );

    const onCloseInventory = useCallback(() => {
        setInventoryOpen(false);
        setInventorySnapshot(null);
    }, []);

    const onOpenInventory = useCallback(() => {
        if (!unit?.id || !unit.interactions.canInventory) {
            return;
        }

        setInventoryOpen(true);
        setInventorySnapshot(null);
        sendMessage({
            type: "client:unit:inventory",
            payload: { unitId: unit.id }
        });
    }, [sendMessage, unit?.id, unit?.interactions.canInventory]);

    const onInventoryUse = useCallback(
        (itemId: ItemId) => {
            if (!unit?.id) {
                return;
            }
            setDisabled(true);
            sendMessage({
                type: "client:unit:inventory:use",
                payload: { unitId: unit.id, itemId }
            });
        },
        [sendMessage, unit?.id]
    );

    const onInventoryUnuse = useCallback(() => {
        if (!unit?.id) {
            return;
        }
        setDisabled(true);
        sendMessage({
            type: "client:unit:inventory:unuse",
            payload: { unitId: unit.id }
        });
    }, [sendMessage, unit?.id]);

    const onInventoryDrop = useCallback(
        (itemId: ItemId) => {
            if (!unit?.id) {
                return;
            }
            setDisabled(true);
            sendMessage({
                type: "client:unit:inventory:drop",
                payload: { unitId: unit.id, itemId }
            });
        },
        [sendMessage, unit?.id]
    );

    const onInventoryPickup = useCallback(
        (itemId: ItemId, use?: boolean) => {
            if (!unit?.id) {
                return;
            }
            setDisabled(true);
            sendMessage({
                type: "client:unit:inventory:pickup",
                payload: { unitId: unit.id, itemId, use }
            });
        },
        [sendMessage, unit?.id]
    );

    const onInventoryLoad = useCallback(
        (receiverId: ItemId, ammoId: ItemId) => {
            if (!unit?.id) {
                return;
            }
            setDisabled(true);
            sendMessage({
                type: "client:unit:inventory:load",
                payload: { unitId: unit.id, receiverId, ammoId }
            });
        },
        [sendMessage, unit?.id]
    );

    const onInventoryUnload = useCallback(
        (itemId: ItemId) => {
            if (!unit?.id) {
                return;
            }
            setDisabled(true);
            sendMessage({
                type: "client:unit:inventory:unload",
                payload: { unitId: unit.id, itemId }
            });
        },
        [sendMessage, unit?.id]
    );

    const onInventoryReorder = useCallback(
        (fromIndex: number, toIndex: number) => {
            if (!unit?.id) {
                return;
            }
            setDisabled(true);
            sendMessage({
                type: "client:unit:inventory:reorder",
                payload: { unitId: unit.id, fromIndex, toIndex }
            });
        },
        [sendMessage, unit?.id]
    );

    useEffect(() => {
        setInventoryOpen(false);
        setInventorySnapshot(null);
    }, [unit?.id]);

    useEffect(() => {
        if (sidePanelMode !== MapMode.enum["unit-mode"]) {
            setInventoryOpen(false);
            setInventorySnapshot(null);
        }
    }, [sidePanelMode]);

    const onPrime = useCallback(
        (prime: Prime) => {
            if (unit?.id && unitWeapon?.id) {
                sendMessage({
                    type: "client:unit:prime",
                    payload: {
                        unitId: unit.id,
                        itemId: unitWeapon.id,
                        prime
                    }
                });
            }
        },
        [sendMessage, unit?.id, unitWeapon?.id]
    );

    useLayoutEffect(() => {
        const unitId = unit?.id;
        const showMenu =
            sidePanelMode === MapMode.enum["unit-mode"] && unitActionMode && unitId != null;

        if (!showMenu) {
            world.unregisterAnchoredOverlay(World.ACTION_MENU_OVERLAY_ID);
            return;
        }

        const tilePos = world.actionMenuTilePos;
        if (!tilePos) {
            return;
        }

        world.registerAnchoredOverlay(
            World.ACTION_MENU_OVERLAY_ID,
            () => actionMenuRef.current,
            new TilePos(tilePos)
        );

        if (actionMenuRef.current) {
            fadeInElement(actionMenuRef.current);
        }

        return () => {
            world.unregisterAnchoredOverlay(World.ACTION_MENU_OVERLAY_ID);
        };
        // Key off unit.id so location/APts updates do not re-trigger fade-in.
        // Same-unit tile tracking is handled by World.unit → updateAnchoredOverlayTile.
    }, [sidePanelMode, unit?.id, unitActionMode, world]);

    world.actionMenuRef = actionMenuRef;

    return {
        actionMenuRef,
        map,
        unit,
        unitWeapon,
        turn,
        side,
        tileInfo,
        sidePanelMode,
        error,
        disabled,
        isOnTarget,
        opportunityFire,
        unitActionMode,
        nextUnit,
        onMove,
        onRotateTo,
        onChangeFireSelector,
        onChangeFireMode,
        onChangeWeaponIndex,
        onEndMovement,
        onEndTurn,
        onEndError,
        onFireMode,
        onEndFireMode,
        onAction,
        onUnitActionMode,
        inventoryOpen,
        inventorySnapshot,
        onOpenInventory,
        onCloseInventory,
        onInventoryUse,
        onInventoryUnuse,
        onInventoryDrop,
        onInventoryPickup,
        onInventoryLoad,
        onInventoryUnload,
        onInventoryReorder,
        setIsOnTarget,
        onPrime
    };
}
