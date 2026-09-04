import { useEffect } from "react";
import { EditorWorld } from "../EditorWorld";
import { useEditorMessageManager } from "./useEditorMessageManager";

export function useEditorWorld() {
    const { sendMessage } = useEditorMessageManager();
    const world = EditorWorld.GetSingleton();

    useEffect(() => {
        world.sendMessage = sendMessage;
    }, [world, sendMessage]);

    return { world };
}
