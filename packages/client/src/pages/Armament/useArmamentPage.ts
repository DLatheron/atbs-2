import { useCallback } from "react";
import { useServerMessageManager } from "../../hooks";

export function useArmamentPage() {
    const { sendMessage } = useServerMessageManager();

    const onEndArmamentPhase = useCallback(() => {
        sendMessage({
            type: "client:armament:end",
            payload: undefined
        });
    }, [sendMessage]);

    return { onEndArmamentPhase };
}
