import { ServerToClientMessage } from "@atbs/shared-data";
import { useServerSocket } from "./hooks";
import { useClientId } from "./hooks/useClientId";
import { MessageManager } from "@atbs/misc";
import { useCallback, useRef, useState } from "react";
import { GameSocket } from "./GameSocket";
import { LobbyPage } from "./pages/lobby/Lobby";

interface ServerMessageContext {
    name: string;
}

interface Server {
    name: string;
}

export type ServerMessageManager = MessageManager<
    ServerMessageContext,
    ServerToClientMessage,
    Server
>;

export function App() {
    const { clientId } = useClientId();
    const messageManagerRef = useRef<ServerMessageManager>(null);
    const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);

    const onConnected = useCallback((gameSocket: GameSocket) => {
        const context: ServerMessageContext = {
            name: "Default Client Name - probably not used"
        };
        const messageManager = new MessageManager<
            ServerMessageContext,
            ServerToClientMessage,
            Server
        >(context);
        messageManagerRef.current = messageManager;

        gameSocket.send({
            type: "client:ping",
            payload: { nonce: 1234 }
        });

        messageManager.registerHandler("server:hello", (context, payload) => {
            console.info({ context, payload });
        });
        messageManager.registerHandler("server:pong", (context, payload) => {
            console.info({ context, payload });

            gameSocket.send({
                type: "client:ping",
                payload: { nonce: payload.nonce++ }
            });
        });
        messageManager.registerHandler("lobby:state", (_context, payload) => {
            setLobbyState(payload);
        });
        messageManager.registerHandler("lobby:client:connected", (_context, payload) => {
            console.info(`*** Client '${payload.name}' (${payload.clientId}) connected ***`);
        });
        messageManager.registerHandler("lobby:client:disconnected", (_context, payload) => {
            console.info(`*** Client '${payload.name}' (${payload.clientId}) disconnected ***`);
        });
    }, []);
    const onDisconnected = useCallback(() => {
        messageManagerRef.current = null;
        setLobbyState(null);
    }, []);
    const onMessage = useCallback((data: unknown) => {
        let message: ServerToClientMessage;

        try {
            message = ServerToClientMessage.parse(JSON.parse(String(data)));
        } catch {
            return;
        }

        messageManagerRef.current?.enqueueMessage(message, { name: "Server" });
    }, []);

    const { connected, gameId, clientName } = useServerSocket({
        clientId,
        onConnected,
        onDisconnected,
        onMessage
    });

    return (
        <>
            <p>Client ID: {clientId}</p>
            <p>Game ID: {gameId}</p>
            <p>{connected ? "Connected to Server" : "Disconnected"}</p>
            <LobbyPage initialClientName={clientName} lobbyState={lobbyState} />
        </>
    );
}
