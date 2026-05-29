import { useCallback, useEffect, useState } from "react";
import {
    ClientQueryParams,
    parseURLSearchParams,
    Phase,
    ServerToClientMessage
} from "@atbs/shared-data";

import { Server, useServerMessageManager, useServerSocket } from "./hooks";
import { useClientId } from "./hooks/useClientId";
import { GameSocket } from "./GameSocket";
import { LobbyPage, LogEntry, MainMenuPage } from "./pages";
import { useSearchParams } from "react-router-dom";
import { Container } from "@mui/material";

export function App() {
    const { clientId } = useClientId();
    const [searchParams] = useSearchParams();
    const validatedSearchParams = parseURLSearchParams(ClientQueryParams, searchParams);
    const { name } = validatedSearchParams;

    const [phase, setPhase] = useState<Phase>(Phase.Enum.main_menu);
    const [clientName, setClientName] = useState<string>(name ?? "Default Client Name");

    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    const { messageManager, sendMessage, setGameSocket } = useServerMessageManager();

    const addLogEntry = useCallback(
        (logEntry: LogEntry) => {
            setLogEntries((logEntries) => [...logEntries, logEntry]);
        },
        [setLogEntries]
    );

    useEffect(() => {
        console.info("Mounting App Message Handlers");
        const handlerHandles = [
            messageManager.registerHandler("server:hello", (context, payload) => {
                console.info({ context, payload });
            }),
            messageManager.registerHandler("server:pong", (context, payload) => {
                console.info({ context, payload });

                // gameSocketRef.current?.send({
                //     type: "client:ping",
                //     payload: { nonce: payload.nonce++ }
                // });
            }),
            messageManager.registerHandler("server:phase", (_context, payload) => {
                console.info("Setting Phase", payload.phase);
                setPhase(payload.phase);
            }),
            messageManager.registerHandler("client:connected", (_context, payload) => {
                addLogEntry({ text: `😀 Client '${payload.client.name}' connected` });
            }),
            messageManager.registerHandler("client:disconnected", (_context, payload) => {
                addLogEntry({ text: `😢 Client '${payload.client.name}' disconnected` });
            })
        ];

        return () => {
            console.info("Unmounting App Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
            // messageManager.unregisterHandler("server:hello");
            // messageManager.unregisterHandler("server:pong");
            // messageManager.unregisterHandler("server:phase");
            // messageManager.unregisterHandler("client:connected");
            // messageManager.unregisterHandler("client:disconnected");
        };
    }, [messageManager, addLogEntry]);

    const onConnected = useCallback(
        (gameSocket: GameSocket) => {
            setGameSocket(gameSocket);
        },
        [setGameSocket]
    );

    const onDisconnected = useCallback(() => {
        setGameSocket(null);
        setPhase(Phase.Enum.main_menu);
    }, [setGameSocket]);

    const onMessage = useCallback(
        (data: unknown) => {
            let message: ServerToClientMessage;

            try {
                message = ServerToClientMessage.parse(JSON.parse(String(data)));
            } catch {
                return;
            }

            messageManager.enqueueMessage(message, Server);
        },
        [messageManager]
    );

    const { gameId, createGame, joinGame, leaveGame } = useServerSocket({
        clientId,
        clientName,
        onConnected,
        onDisconnected,
        onMessage
    });

    if (!clientId) {
        return null;
    }

    return (
        <Container sx={{ maxWidth: "100vw", maxHeight: "100vh" }}>
            <MainMenuPage
                visible={phase === Phase.Enum.main_menu}
                defaultGameId={gameId}
                onCreateGame={createGame}
                onJoinGame={joinGame}
            />
            <LobbyPage
                visible={phase === Phase.Enum.lobby}
                clientId={clientId}
                initialClientName={clientName}
                gameId={gameId}
                onClientNameChanged={(name) => {
                    async function updateClientName(name: string) {
                        sendMessage({
                            type: "client:rename",
                            payload: { name }
                        });
                        setClientName(name);
                    }

                    updateClientName(name);
                }}
                onCreateGame={createGame}
                onJoinGame={joinGame}
                onLeaveGame={() => {
                    leaveGame();
                    setPhase(Phase.Enum.main_menu);
                }}
                logEntries={logEntries}
                addLogEntry={addLogEntry}
            />
        </Container>
    );
}
