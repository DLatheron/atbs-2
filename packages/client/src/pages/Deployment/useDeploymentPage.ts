import { useCallback } from "react";
import { useServerMessageManager } from "../../hooks";

export function useDeploymentPage() {
    const { sendMessage } = useServerMessageManager();

    const onEndDeploymentPhase = useCallback(() => {
        sendMessage({
            type: "client:deployment:end",
            payload: undefined
        });
    }, [sendMessage]);

    return { onEndDeploymentPhase };
}
