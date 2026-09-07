import { useCallback, useEffect, useRef, useState } from "react";
import {
    ClientQueryParams,
    parseURLSearchParams,
    Phase,
    ServerToClientMessage,
    WaitingFor
} from "@atbs/shared-data";

import { Server, useServerMessageManager, useServerSocket } from "./hooks";
import { useClientId } from "./hooks/useClientId";
import { GameSocket } from "./GameSocket";
import {
    ArmamentPage,
    DeploymentPage,
    GameOverPage,
    GAME_OVER_DISPLAY_DELAY_MS,
    LobbyPage,
    MainMenuPage,
    ActionPage,
    type GameOverResult
} from "./pages";
import { useSearchParams } from "react-router-dom";
import { WaitModal } from "./modals";
import { Container } from "@mui/material";

export function App() {
    const { clientId } = useClientId();
    const [searchParams] = useSearchParams();
    const validatedSearchParams = parseURLSearchParams(ClientQueryParams, searchParams);
    const { name } = validatedSearchParams;

    const [waitingFor, setWaitingFor] = useState<WaitingFor | null>(null);

    const [phase, setPhase] = useState<Phase>(Phase.enum.main_menu);
    const phaseRef = useRef<Phase>(Phase.enum.main_menu);
    const [clientName, setClientName] = useState<string>(name ?? "Default Client Name");
    const [gameOverResult, setGameOverResult] = useState<GameOverResult | null>(null);
    const gameOverDelayTimerRef = useRef<number | null>(null);

    const { messageManager, sendMessage, setGameSocket } = useServerMessageManager();

    const clearGameOverDelayTimer = useCallback(() => {
        if (gameOverDelayTimerRef.current != null) {
            window.clearTimeout(gameOverDelayTimerRef.current);
            gameOverDelayTimerRef.current = null;
        }
    }, []);

    const onConnected = useCallback(
        (gameSocket: GameSocket) => {
            setGameSocket(gameSocket);
        },
        [setGameSocket]
    );

    const onDisconnected = useCallback(() => {
        clearGameOverDelayTimer();
        setGameSocket(null);
        phaseRef.current = Phase.enum.main_menu;
        setPhase(Phase.enum.main_menu);
        setWaitingFor(null);
        setGameOverResult(null);
    }, [setGameSocket, clearGameOverDelayTimer]);

    const onMessage = useCallback(
        (data: unknown) => {
            let message: ServerToClientMessage;

            try {
                const jsonData = String(data);
                const preParsedMessage = JSON.parse(jsonData);

                message = ServerToClientMessage.parse(preParsedMessage);
            } catch (error) {
                console.error("Failed to parse server message", data, error);
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

    const dismissGameOver = useCallback(() => {
        clearGameOverDelayTimer();
        leaveGame();
        setGameOverResult(null);
        setWaitingFor(null);
        phaseRef.current = Phase.enum.main_menu;
        setPhase(Phase.enum.main_menu);
    }, [leaveGame, clearGameOverDelayTimer]);

    useEffect(() => {
        console.info("Mounting App Message Handlers");
        const handlerHandles = [
            messageManager.registerHandler("server:hello", (context, payload) => {
                console.info({ context, payload });
            }),
            messageManager.registerHandler("server:pong", (context, payload) => {
                console.info({ context, payload });
            }),
            messageManager.registerHandler("server:phase", (_context, payload) => {
                console.info("Setting Phase", payload.phase);
                // Keep the action UI visible; game:over owns the delayed switch to results.
                if (payload.phase === Phase.enum.game_over) {
                    setWaitingFor(null);
                    return;
                }
                phaseRef.current = payload.phase;
                setPhase(payload.phase);
                setWaitingFor(null);
            }),
            messageManager.registerHandler("server:game:over", (_context, payload) => {
                setGameOverResult(payload);
                setWaitingFor(null);
                clearGameOverDelayTimer();
                gameOverDelayTimerRef.current = window.setTimeout(() => {
                    gameOverDelayTimerRef.current = null;
                    phaseRef.current = Phase.enum.game_over;
                    setPhase(Phase.enum.game_over);
                }, GAME_OVER_DISPLAY_DELAY_MS);
            }),
            messageManager.registerHandler("server:client:connected", (_context, { client }) => {
                console.info(`Client '${client.name} (${client.id}) connected`);
            }),
            messageManager.registerHandler("server:client:disconnected", (_context, { client }) => {
                console.info(`Client '${client.name} (${client.id}) disconnected`);
            }),
            messageManager.registerHandler("server:wait", (_context, payload) => {
                setWaitingFor(payload);
            })
        ];

        return () => {
            console.info("Unmounting App Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
            clearGameOverDelayTimer();
        };
    }, [messageManager, clearGameOverDelayTimer]);

    if (!clientId) {
        return null;
    }

    return (
        <Container maxWidth={false} sx={{ m: 0, p: 0 }} disableGutters>
            <MainMenuPage
                visible={phase === Phase.enum.main_menu}
                defaultGameId={gameId}
                onCreateGame={createGame}
                onJoinGame={joinGame}
            />
            <LobbyPage
                key={`lobby-${gameId}`}
                visible={phase === Phase.enum.lobby}
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
                onLeaveGame={() => {
                    leaveGame();
                    phaseRef.current = Phase.enum.main_menu;
                    setPhase(Phase.enum.main_menu);
                }}
            />
            <ArmamentPage key={`armamentlobby-${gameId}`} visible={phase === Phase.enum.armament} />
            <DeploymentPage
                key={`deployment-${gameId}`}
                visible={
                    phase === Phase.enum.deployment && waitingFor?.phase !== Phase.enum.deployment
                }
            />
            <ActionPage key={`turns-${gameId}`} visible={phase === Phase.enum.action} />
            <GameOverPage
                visible={phase === Phase.enum.game_over}
                result={gameOverResult}
                onDismiss={dismissGameOver}
            />
            <WaitModal waitingFor={waitingFor} />
        </Container>
    );
}
