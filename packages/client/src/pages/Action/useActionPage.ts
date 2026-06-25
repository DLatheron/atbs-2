import { useCallback, useEffect, useState } from "react";
import { merge } from "lodash";
import { useServerMessageManager, useWorld } from "../../hooks";
import {
    ClientMap,
    ErrorType,
    FireDetails,
    FireModeItemSummary,
    FireSelector,
    ImageId,
    ItemId,
    OnTarget,
    RenderMode,
    SideSummary,
    ThrowDetails,
    TileInfo,
    UnitSummary
} from "@atbs/shared-data";
import { ImageCache } from "../../ImageCache";
import { useImageCache } from "../../hooks/useImageCache";
import { Orientation, TilePos, Vec2 } from "@atbs/maths";
import { MapMode } from "../../MapMode";

function delay(delayInMs: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, delayInMs));
}

export function useActionPage() {
    const { messageManager, sendMessage } = useServerMessageManager();
    const { imageCache } = useImageCache();
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

    useEffect(() => {
        console.info("Mounting ActionPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:map", async (_context, payload) => {
                console.info("$$$ Received map message $$$", payload.width, "x", payload.height);

                const imageSet = ImageCache.CacheClientMapImages(payload);

                // TEMPORARY:
                imageSet.add("fireMode");
                imageSet.add("throw");
                imageSet.add("action");
                imageSet.add("inventory");
                imageSet.add("fireSingle");
                imageSet.add("fireBurst");
                imageSet.add("fireAuto");

                await imageCache.waitForImagesToCache(imageSet);

                world.map = payload;
                setMap(payload);

                await world._waitForRenderStart;
            }),

            messageManager.registerHandler("server:unit:mode:move", async (_context, payload) => {
                console.info("$$$ Received unit message $$$", payload?.id);

                if (payload) {
                    const imageSet = new Set<ImageId>();
                    ImageCache.CacheRenderListImages(payload.uiImage, imageSet);
                    if (payload.itemInUse) {
                        ImageCache.CacheRenderListImages(payload.itemInUse.uiImage, imageSet);
                    }
                    await imageCache.waitForImagesToCache(imageSet);
                }

                setUnit(payload);
                world.unit = payload;
                if (payload) {
                    setSidePanelMode(MapMode.enum["unit-mode"]);
                    world.mapMode = MapMode.enum["unit-mode"];
                } else {
                    setSidePanelMode(MapMode.enum["map-mode"]);
                    world.mapMode = MapMode.enum["map-mode"];
                }
            }),

            messageManager.registerHandler("server:unit:mode:fire", async (_context, payload) => {
                console.info("$$$ Received unit message $$$", payload?.id);

                if (payload) {
                    const imageSet = new Set<ImageId>();
                    ImageCache.CacheRenderListImages(payload.uiImage, imageSet);
                    for (const weapon of payload.weapons) {
                        ImageCache.CacheRenderListImages(weapon.uiImage, imageSet);
                    }
                    await imageCache.waitForImagesToCache(imageSet);
                }

                setUnitWeapon(payload);
                world.unitWeapon = payload;
                if (payload) {
                    setSidePanelMode(MapMode.enum["fire-mode"]);
                    world.mapMode = MapMode.enum["fire-mode"];
                } else {
                    setSidePanelMode(MapMode.enum["map-mode"]);
                    world.mapMode = MapMode.enum["map-mode"];
                }
            }),

            messageManager.registerHandler("server:turn:start", (_context, payload) => {
                setTurn(payload.turn);
            }),

            messageManager.registerHandler("server:side:start", (_context, payload) => {
                setSide(payload.side);
            }),

            messageManager.registerHandler("server:game:tile:info", async (_context, payload) => {
                const imageSet = new Set<ImageId>();
                ImageCache.CacheRenderListImages(payload.terrain.uiImage, imageSet);
                if (payload.unit) {
                    ImageCache.CacheRenderListImages(payload.unit.uiImage, imageSet);
                }

                await imageCache.waitForImagesToCache(imageSet);

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

            messageManager.registerHandler("server:map:update", async (_context, payload) => {
                const imageSet = new Set<ImageId>();

                for (const update of payload) {
                    ImageCache.CacheRenderListImages(
                        update.tileByRenderMode[RenderMode.enum.MAP_MODE],
                        imageSet
                    );
                    ImageCache.CacheRenderListImages(
                        update.tileByRenderMode[RenderMode.enum.FIRE_MODE],
                        imageSet
                    );
                }

                await imageCache.waitForImagesToCache(imageSet);

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
                setUnit((unit: UnitSummary | null) => (unit ? merge({}, unit, payload) : null));
                world.unit = merge({}, world.unit, payload);
            }),

            messageManager.registerHandler("server:unit:weapon:update", (_context, payload) => {
                setUnitWeapon((weap: FireModeItemSummary | null) =>
                    weap ? merge({}, weap, payload) : null
                );
                world.unitWeapon = merge({}, world.unitWeapon, payload);
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
                world.setTracers(payload.tracers, () => {
                    setIsOnTarget(OnTarget.enum.none);
                    resolver(undefined);
                });

                console.info("!!! Queue blocked");
                await block;
                console.info(">>> Queue unblocked");
            }),

            messageManager.registerHandler("server:debug:graphics", async (_context, payload) => {
                world.debugGraphics = payload;
            })
        ];

        return () => {
            console.info("Unmounting ActionPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, sendMessage, world, imageCache]);

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
        setSidePanelMode(MapMode.enum["unit-mode"]);
        world.mapMode = MapMode.enum["unit-mode"];
    }, [world]);

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

    const onFire = useCallback(
        (details: FireDetails) => {
            setDisabled(true);

            sendMessage({
                type: "client:unit:fire",
                payload: details
            });
        },
        [sendMessage]
    );

    useEffect(() => {
        world.fireCallback = onFire;
    }, [world, onFire]);

    const onThrow = useCallback(
        (details: ThrowDetails) => {
            setDisabled(true);

            sendMessage({
                type: "client:unit:throw",
                payload: details
            });
        },
        [sendMessage]
    );

    useEffect(() => {
        world.throwCallback = onThrow;
    }, [world, onThrow]);

    return {
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
        onMove,
        onRotateTo,
        onChangeFireSelector,
        onEndMovement,
        onEndTurn,
        onEndError,
        onFireMode,
        onEndFireMode,
        setIsOnTarget
    };
}
