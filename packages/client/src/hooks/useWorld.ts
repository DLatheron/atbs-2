import { useEffect } from "react";
import { GameWorld } from "../GameWorld";
import { useServerMessageManager } from "./useServerMessageManager";

export function useWorld() {
    const { sendMessage } = useServerMessageManager();
    const world = GameWorld.GetSingleton();

    useEffect(() => {
        world.sendMessage = sendMessage;
    }, [world, sendMessage]);

    return { world };
}
