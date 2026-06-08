import { useEffect } from "react";
import { World } from "../World";
import { useServerMessageManager } from "./useServerMessageManager";

export function useWorld() {
    const { sendMessage } = useServerMessageManager();
    const world = World.GetSingleton();

    useEffect(() => {
        world.sendMessage = sendMessage;
    }, [world, sendMessage]);

    return { world };
}
