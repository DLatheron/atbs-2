import { useCallback, useEffect, useState } from "react";
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
import { ArmamentPage, DeploymentPage, LobbyPage, MainMenuPage, ActionPage } from "./pages";
import { useSearchParams } from "react-router-dom";
import { WaitModal } from "./modals";

export function App() {
    const { clientId } = useClientId();
    const [searchParams] = useSearchParams();
    const validatedSearchParams = parseURLSearchParams(ClientQueryParams, searchParams);
    const { name } = validatedSearchParams;

    const [waitingFor, setWaitingFor] = useState<WaitingFor | null>(null);

    const [phase, setPhase] = useState<Phase>(Phase.enum.main_menu);
    const [clientName, setClientName] = useState<string>(name ?? "Default Client Name");

    const { messageManager, sendMessage, setGameSocket } = useServerMessageManager();

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
        };
    }, [messageManager]);

    const onConnected = useCallback(
        (gameSocket: GameSocket) => {
            setGameSocket(gameSocket);
        },
        [setGameSocket]
    );

    const onDisconnected = useCallback(() => {
        setGameSocket(null);
        setPhase(Phase.enum.main_menu);
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
        <>
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
                    setPhase(Phase.enum.main_menu);
                }}
            />
            <ArmamentPage key={`armamentlobby-${gameId}`} visible={phase === Phase.enum.armament} />
            <DeploymentPage
                key={`deployment-${gameId}`}
                visible={phase === Phase.enum.deployment}
            />
            <ActionPage key={`turns-${gameId}`} visible={phase === Phase.enum.action} />
            <WaitModal waitingFor={waitingFor} />
        </>
    );
}
