import { MessageManager } from "@atbs/misc";
import { ClientToServerMessage, ServerToClientMessage } from "@atbs/shared-data";
import { EditorSocket } from "../EditorSocket";
import { useCallback } from "react";

interface EditorServer {
    name: "EditorServer";
}

export const EditorServer: EditorServer = {
    name: "EditorServer"
};

interface EditorMessageContext {
    name: string;
}

const context: EditorMessageContext = {
    name: "Not used at the moment"
};

// Singleton message manager for this editor client instance.
const globalEditorMessageManager = new MessageManager<
    EditorMessageContext,
    ServerToClientMessage,
    EditorServer
>(context);

// Singleton editor socket for this client instance.
let globalEditorSocket: EditorSocket | null = null;

export function useEditorMessageManager() {
    const sendMessage = useCallback((message: ClientToServerMessage) => {
        globalEditorSocket?.send(message);
    }, []);
    const setEditorSocket = useCallback((editorSocket: EditorSocket | null) => {
        globalEditorSocket = editorSocket;
    }, []);

    return {
        messageManager: globalEditorMessageManager,
        sendMessage,
        setEditorSocket
    };
}
