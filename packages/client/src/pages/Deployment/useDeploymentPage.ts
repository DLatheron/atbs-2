import { useCallback, useEffect, useState } from "react";
import { useServerMessageManager, useWorld } from "../../hooks";
import { ClientMap, SideSummary } from "@atbs/shared-data";

export function useDeploymentPage() {
    const { messageManager, sendMessage } = useServerMessageManager();
    const { world } = useWorld();
    const [map, setMap] = useState<ClientMap | null>(null);
    const [side /*, setSide*/] = useState<SideSummary | null>(null);
    const [disabled /*, setDisabled*/] = useState<boolean>(false);

    useEffect(() => {
        console.info("Mounting DeploymentPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:map", (_context, payload) => {
                console.info("$$$ Received map message $$$", payload.width, "x", payload.height);

                world.map = payload;
                setMap(payload);
            })
        ];

        return () => {
            console.info("Unmounting ActionPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, world]);

    const onEndDeploymentPhase = useCallback(() => {
        sendMessage({
            type: "client:deployment:end",
            payload: null
        });
    }, [sendMessage]);

    return {
        map,
        side,
        disabled,
        onEndDeploymentPhase
    };
}
