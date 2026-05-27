import { useCallback, useRef, useState } from "react";
import {
    ClientId,
    ClientQueryParams,
    GameId,
    LobbyState,
    parseURLSearchParams,
    ServerToClientMessage,
    SideId
} from "@atbs/shared-data";
import { MessageManager } from "@atbs/misc";

import { useServerSocket } from "./hooks";
import { useClientId } from "./hooks/useClientId";
import { GameSocket } from "./GameSocket";
import { LobbyPage, LogEntry } from "./pages";
import { useSearchParams } from "react-router-dom";

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
    const [searchParams, setSearchParams] = useSearchParams();
    const validatedSearchParams = parseURLSearchParams(ClientQueryParams, searchParams);
    const { name } = validatedSearchParams;

    const messageManagerRef = useRef<ServerMessageManager>(null);
    const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
    const [clientName, setClientName] = useState<string>(name ?? "Default Client Name");
    const gameSocketRef = useRef<GameSocket>(null);

    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    const onConnected = useCallback((gameSocket: GameSocket) => {
        gameSocketRef.current = gameSocket;

        const context: ServerMessageContext = {
            name: "Not used at the moment"
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
            setLogEntries((logEntries) => [
                ...logEntries,
                {
                    type: "connected",
                    text: `😀 Client '${payload.name}' connected`
                }
            ]);
        });
        messageManager.registerHandler("lobby:client:disconnected", (_context, payload) => {
            setLogEntries((logEntries) => [
                ...logEntries,
                {
                    type: "disconnected",
                    text: `😢 Client '${payload.name}' disconnected`
                }
            ]);
        });
        messageManager.registerHandler("server:client:renamed", (_context, payload) => {
            setLogEntries((logEntries) => [
                ...logEntries,
                {
                    type: "renamed",
                    text: `🪪 Client '${payload.oldName}' renamed to '${payload.newName}'`
                }
            ]);
        });
        messageManager.registerHandler("server:client:side:changed", (_context, payload) => {
            console.info(`*** Client joined '${payload.new?.sideName ?? "null"}'`);
            if (payload.new && !payload.old) {
                setLogEntries((logEntries) => [
                    ...logEntries,
                    {
                        type: "side",
                        text: `➡️ Client joined '${payload.new?.sideName}'`
                    }
                ]);
            } else if (payload.old && !payload.new) {
                setLogEntries((logEntries) => [
                    ...logEntries,
                    {
                        type: "side",
                        text: `⬅️ Client left '${payload.old?.sideName}'`
                    }
                ]); 
            } else if (payload.old && payload.new) {
                setLogEntries((logEntries) => [
                    ...logEntries,
                    {
                        type: "side",
                        text: `🔀 Client left '${payload.old?.sideName}' and joined '${payload.new?.sideName}'`
                    }
                ]);                 
            }
        });
        messageManager.registerHandler("server:client:ready", (_context, payload) => {
            if (payload.ready) {
                console.info(`*** Client ${payload.client.name} is ready!`)
                setLogEntries((logEntries) => [
                    ...logEntries,
                    {
                        text: `✅ Client '${payload.client.name} is ready!`
                    }
                ]);
            } else {
                console.info(`*** Client ${payload.client.name} is not ready`)
                setLogEntries((logEntries) => [
                    ...logEntries,
                    {
                        text: `❌ Client '${payload.client.name} is not ready`
                    }
                ]);
            }          
        })
    }, []);

    const onDisconnected = useCallback(() => {
        gameSocketRef.current = null;
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

    const changeSideId = useCallback((clientId: ClientId, sideId: SideId | null) => {
        gameSocketRef.current?.send({
            type: "client:side:change",
            payload: { clientId, sideId }
        });
    }, []);

    const changeReady = useCallback((ready: boolean) => {
        gameSocketRef.current?.send({
            type: "client:ready",
            payload: { ready }
        });
    }, []);

    const { connected, gameId, createGame, joinGame, leaveGame } = useServerSocket({
        clientId,
        clientName,
        onConnected,
        onDisconnected,
        onMessage
    });

    return (
        <LobbyPage
            clientId={clientId}
            initialClientName={clientName}
            gameId={gameId}
            onClientNameChanged={(name) => {
                async function updateClientName(name: string) {
                    gameSocketRef.current?.send({
                        type: "client:rename",
                        payload: { name }
                    });
                    setClientName(name);
                }

                updateClientName(name);
            }}
            onGameIdChanged={
                connected
                    ? undefined
                    : (gameId: GameId) => {
                          setSearchParams((searchParams) => {
                              searchParams.set("game-id", gameId);
                              return searchParams;
                          });
                      }
            }
            onCreateGame={createGame}
            onJoinGame={joinGame}
            onLeaveGame={leaveGame}
            onSideIdChange={changeSideId}
            onReadyChange={changeReady}
            logEntries={logEntries}
            lobbyState={lobbyState}
        />
    );
}
