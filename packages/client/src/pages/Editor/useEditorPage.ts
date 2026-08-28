import { useCallback, useEffect, useState } from "react";
import { useEditorMessageManager } from "../../hooks/useEditorMessageManager";
import { useWorld } from "../../hooks";
import { ClientMap } from "@atbs/shared-data";

export function useEditorPage() {
    const { messageManager, sendMessage } = useEditorMessageManager();
    const { world } = useWorld();
    const [map, setMap] = useState<ClientMap | null>(null);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    useEffect(() => {
        console.info("Mounting EditorPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:editor:map", (_context, payload) => {
                console.info("Received editor map", payload.width, "x", payload.height);
                world.map = payload;
                setMap(payload);
            }),

            messageManager.registerHandler("server:editor:saved", (_context, payload) => {
                const message = `Saved ${payload.mapId} as ${payload.filename}`;
                console.info(message);
                setSavedMessage(message);
            })
        ];

        return () => {
            console.info("Unmounting EditorPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, world]);

    useEffect(() => {
        if (!savedMessage) {
            return;
        }
        const timer = window.setTimeout(() => setSavedMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [savedMessage]);

    const onSave = useCallback(() => {
        sendMessage({
            type: "client:editor:save",
            payload: {}
        });
    }, [sendMessage]);

    return {
        map,
        savedMessage,
        onSave
    };
}
