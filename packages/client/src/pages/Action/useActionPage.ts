import { useCallback, useEffect, useState } from "react";
import { merge } from "lodash";
import { useServerMessageManager, useWorld } from "../../hooks";
import {
    ClientMap,
    ErrorType,
    FireModeItemSummary,
    ImageId,
    ItemSummary,
    RenderMode,
    SideSummary,
    TileInfo,
    UnitSummary
} from "@atbs/shared-data";
import { ImageCache } from "../../ImageCache";
import { useImageCache } from "../../hooks/useImageCache";
import { Orientation, TilePos, Vec2 } from "@atbs/maths";

function delay(delayInMs: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, delayInMs));
}

export function useActionPage() {
    const { messageManager, sendMessage } = useServerMessageManager();
    const { imageCache } = useImageCache();
    const { world } = useWorld();
    const [sidePanelMode, setSidePanelMode] = useState<
        "map-mode" | "move-mode" | "fire-mode" | "throw-mode"
    >("map-mode");
    const [side, setSide] = useState<SideSummary | null>(null);
    const [turn, setTurn] = useState<number>(0);
    const [map, setMap] = useState<ClientMap | null>(null);
    const [unit, setUnit] = useState<UnitSummary | null>(null);
    const [unitWeapon, setUnitWeapon] = useState<FireModeItemSummary | null>(null);
    const [unitItem, setUnitItem] = useState<ItemSummary | null>(null);
    const [tileInfo, setTileInfo] = useState<TileInfo | null>(null);
    const [error, setError] = useState<ErrorType | null>(null);
    const [disabled, setDisabled] = useState<boolean>(false);

    // // Temporary hack to reload the world if necessary...
    // useEffect(() => {
    //     sendMessage({
    //         type: "client:game:refresh",
    //         payload: null
    //     });
    // }, [sendMessage, world.hasMap]);

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
                if (payload) {
                    setSidePanelMode("move-mode");
                } else {
                    setSidePanelMode("map-mode");
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
                if (payload) {
                    setSidePanelMode("fire-mode");
                } else {
                    setSidePanelMode("map-mode");
                }
            }),

            messageManager.registerHandler("server:unit:mode:throw", async (_context, payload) => {
                console.info("$$$ Received unit message $$$", payload?.id);

                if (payload) {
                    const imageSet = new Set<ImageId>();
                    ImageCache.CacheRenderListImages(payload.uiImage, imageSet);
                    await imageCache.waitForImagesToCache(imageSet);
                }

                setUnitItem(payload);
                if (payload) {
                    setSidePanelMode("throw-mode");
                } else {
                    setSidePanelMode("map-mode");
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
            }),

            messageManager.registerHandler("server:error", (_context, error) => {
                setError(error);
            }),

            messageManager.registerHandler("server:ui:disabled", (_context, disabled) => {
                setDisabled(disabled);
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

    const onThrowMode = useCallback(() => {
        if (unit?.id) {
            sendMessage({
                type: "client:unit:mode:throw",
                payload: unit.id
            });
        }
    }, [sendMessage, unit?.id]);

    const onEndFireMode = useCallback(() => {
        setSidePanelMode("move-mode");
    }, []);

    const onEndThrowMode = useCallback(() => {
        setSidePanelMode("move-mode");
    }, []);

    return {
        map,
        unit,
        unitWeapon,
        unitItem,
        turn,
        side,
        tileInfo,
        sidePanelMode,
        error,
        disabled,
        onMove,
        onRotateTo,
        onEndMovement,
        onEndTurn,
        onEndError,
        onFireMode,
        onThrowMode,
        onEndFireMode,
        onEndThrowMode
    };
}
