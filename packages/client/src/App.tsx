import { useCallback, useRef, useState } from "react";
import {
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
            console.info("New lobby state", payload);
            setLobbyState(payload);
        });
        messageManager.registerHandler("lobby:client:connected", (_context, payload) => {
            console.info(`*** Client '${payload.name}' (${payload.clientId}) connected ***`);
            setLogEntries((logEntries) => [
                ...logEntries,
                {
                    type: "connected",
                    text: `Client '${payload.name}' connected`
                }
            ]);
        });
        messageManager.registerHandler("lobby:client:disconnected", (_context, payload) => {
            console.info(`*** Client '${payload.name}' (${payload.clientId}) disconnected ***`);
            setLogEntries((logEntries) => [
                ...logEntries,
                {
                    type: "disconnected",
                    text: `Client '${payload.name}' disconnected`
                }
            ]);
        });
        messageManager.registerHandler("server:client:renamed", (_context, payload) => {
            console.info(`*** Client '${payload.oldName}' renamed to '${payload.newName}'`);
            setLogEntries((logEntries) => [
                ...logEntries,
                {
                    type: "renamed",
                    text: `Client '${payload.oldName}' renamed to '${payload.newName}'`
                }
            ]);
        });
        messageManager.registerHandler("server:client:side:changed", (_context, payload) => {
            console.info(`*** Client joined '${payload.new?.sideName ?? "null"}'`);
            // TODO: Joined/left/switched sides.
            setLogEntries((logEntries) => [
                ...logEntries,
                {
                    type: "side",
                    text: payload.new
                        ? `Client joined '${payload.new?.sideName}'`
                        : `Client left '${payload.old?.sideName}'`
                }
            ]);
        });
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

    const changeSideId = useCallback((sideId: SideId | null) => {
        gameSocketRef.current?.send({
            type: "client:side:change",
            payload: { sideId }
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
            logEntries={logEntries}
            lobbyState={lobbyState}
        />
    );
}
