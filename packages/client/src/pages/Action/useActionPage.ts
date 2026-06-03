import { useEffect, useState } from "react";
import { useServerMessageManager, useWorld } from "../../hooks";
import { ClientMap } from "@atbs/shared-data";
import { ImageCache } from "../../ImageCache";
import { useImageCache } from "../../hooks/useImageCache";

export function useActionPage() {
    const { messageManager, sendMessage } = useServerMessageManager();
    const { imageCache } = useImageCache();
    const { world } = useWorld();
    const [map, setMap] = useState<ClientMap | null>(null);
    const [unit, setUnit] = useState<{ id: string } | null>(null);

    // Temporary hack to reload the world if necessary...
    useEffect(() => {
        sendMessage({
            type: "client:game:refresh",
            payload: ""
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
            messageManager.registerHandler("server:unit", (_context, payload) => {
                console.info("$$$ Received unit message $$$", payload.id);
                setUnit(payload);
            })
        ];

        return () => {
            console.info("Unmounting ActionPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, sendMessage, world, imageCache]);

    return { map, unit };
}
