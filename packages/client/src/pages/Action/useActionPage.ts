import { useEffect, useState } from "react";
import { useServerMessageManager } from "../../hooks";
import { ClientMap } from "@atbs/shared-data";

export function useActionPage() {
    const { messageManager } = useServerMessageManager();
    const [map, setMap] = useState<ClientMap | null>(null);

    useEffect(() => {
        console.info("Mounting ActionPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:map", (_context, payload) => {
                setMap(payload);
            })
        ];

        return () => {
            console.info("Unmounting ActionPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager]);

    return { map };
}
