import { ServerToClientMessage } from "@atbs/shared-data";
import { useServerSocket } from "./hooks";
import { useClientId } from "./hooks/useClientId";
import { MessageManager } from "@atbs/misc";
import { useState } from "react";

interface ServerMessageContext {
    name: string;
};

export function App() {
    const { clientId } = useClientId();
    const [/*messageManager*/, setMessageManager] = useState<MessageManager<ServerToClientMessage, ServerMessageContext> | null>(null);
    const { connected, gameId } = useServerSocket({
        clientId,
        onConnected: (gameSocket) => {
            const context: ServerMessageContext = { name: "Default Client Name - probably not used" };
            const messageManager = new MessageManager<ServerToClientMessage, ServerMessageContext>(context);
            setMessageManager(messageManager);

            gameSocket.send({
                type: "client:ping",
                payload: { nonce: 1234 }
            });

            messageManager.registerHandler("server:hello", (payload, context) => {
                console.info({ payload, context });
            });
            messageManager.registerHandler("server:pong", (payload, context) => {
                console.info({ payload, context });

                gameSocket.send({
                    type: "client:ping",
                    payload: { nonce: payload.nonce++ }
                })
            });
        },
        onDisconnected: () => {
            setMessageManager(null);
        }
    });

    return (
        <>
            <p>Client ID: {clientId}</p>
            <p>Game ID: {gameId}</p>
            <p>{connected ? "Connected to Server" : "Disconnected"}</p>
        </>
    );
}
