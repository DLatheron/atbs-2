import { useCallback, useEffect, useState } from "react";
import { useServerMessageManager, useWorld } from "../../hooks";
import { ClientMap, ImageId, SideSummary, TileInfo, UnitSummary } from "@atbs/shared-data";
import { ImageCache } from "../../ImageCache";
import { useImageCache } from "../../hooks/useImageCache";
import { Orientation } from "@atbs/maths";

export function useActionPage() {
    const { messageManager, sendMessage } = useServerMessageManager();
    const { imageCache } = useImageCache();
    const { world } = useWorld();
    const [sidePanelMode, setSidePanelMode] = useState<"map-mode" | "move-mode" | "fire-mode">(
        "map-mode"
    );
    const [side, setSide] = useState<SideSummary | null>(null);
    const [turn, setTurn] = useState<number>(0);
    const [map, setMap] = useState<ClientMap | null>(null);
    const [unit, setUnit] = useState<UnitSummary | null>(null);
    const [tileInfo, setTileInfo] = useState<TileInfo | null>(null);

    // Temporary hack to reload the world if necessary...
    useEffect(() => {
        sendMessage({
            type: "client:game:refresh",
            payload: null
        });
    }, [sendMessage, world.hasMap]);

    useEffect(() => {
        console.info("Mounting ActionPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:map", async (_context, payload) => {
                console.info("$$$ Received map message $$$", payload.width, "x", payload.height);

                const imageSet = ImageCache.CacheClientMapImages(payload);

                await imageCache.waitForImagesToCache(imageSet);

                world.map = payload;
                setMap(payload);
            }),
            messageManager.registerHandler("server:unit:selected", (_context, payload) => {
                console.info("$$$ Received unit message $$$", payload?.id);

                if (payload) {
                    const imageSet = new Set<ImageId>();
                    ImageCache.CacheRenderListImages(payload.uiImage, imageSet);
                }

                setUnit(payload);
                if (payload) {
                    setSidePanelMode("move-mode");
                } else {
                    setSidePanelMode("map-mode");
                }
            }),
            messageManager.registerHandler("server:turn:start", (_context, payload) => {
                setSide(payload.side);
                setTurn(payload.turn);
            }),
            messageManager.registerHandler("server:game:tile:info", async (_context, payload) => {
                const imageSet = new Set<ImageId>();
                ImageCache.CacheRenderListImages(payload.terrain.uiImage, imageSet);
                if (payload.unit) {
                    ImageCache.CacheRenderListImages(payload.unit.uiImage, imageSet);
                }

                await imageCache.waitForImagesToCache(imageSet);

                setTileInfo(payload);
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

    return {
        map,
        unit,
        turn,
        side,
        tileInfo,
        sidePanelMode,
        onMove,
        onRotateTo,
        onEndMovement,
        onEndTurn
    };
}
