import { MessageManager } from "@atbs/misc";
import { ClientToServerMessage, ServerToClientMessage } from "@atbs/shared-data";
import { GameSocket } from "../GameSocket";
import { useCallback } from "react";

interface Server {
    name: "Server";
}

export const Server: Server = {
    name: "Server"
};

interface ServerMessageContext {
    name: string;
}

const context: ServerMessageContext = {
    name: "Not used at the moment"
};

// Singleton message manager for this client instance.
const globalMessageManager = new MessageManager<
    ServerMessageContext,
    ServerToClientMessage,
    Server
>(context);

// Singleton game socket for this client instance.
let globalGameSocket: GameSocket | null = null;

export function useServerMessageManager() {
    const sendMessage = useCallback((message: ClientToServerMessage) => {
        globalGameSocket?.send(message);
    }, []);
    const setGameSocket = useCallback((gameSocket: GameSocket | null) => {
        globalGameSocket = gameSocket;
    }, []);

    return {
        messageManager: globalMessageManager,
        sendMessage,
        setGameSocket
    };
}
