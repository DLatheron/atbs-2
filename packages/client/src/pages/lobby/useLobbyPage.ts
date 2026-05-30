import { useCallback, useEffect, useState } from "react";
import { useServerMessageManager } from "../../hooks";
import { ClientId, LobbyState, ScenarioId, ScenarioSummary } from "@atbs/shared-data";

interface LogEntry {
    text: string;
}

export function useLobbyPage() {
    const { messageManager, sendMessage } = useServerMessageManager();
    const [lobbyState, setLobbyState] = useState<LobbyState>();
    const [scenarios, setScenarios] = useState<ScenarioSummary[]>();
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    const addLogEntry = useCallback(
        (logEntry: LogEntry) => {
            setLogEntries((logEntries) => [...logEntries, logEntry]);
        },
        [setLogEntries]
    );

    useEffect(() => {
        console.info("Mounting LobbyPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:client:connected", (_context, payload) => {
                addLogEntry({ text: `😀 '${payload.client.name}' connected` });
            }),
            messageManager.registerHandler("server:client:disconnected", (_context, payload) => {
                addLogEntry({ text: `😢 '${payload.client.name}' disconnected` });
            }),
            messageManager.registerHandler("server:lobby:state", (_context, payload) => {
                setLobbyState(payload);
            }),
            messageManager.registerHandler("server:lobby:client:renamed", (_context, payload) => {
                addLogEntry({
                    text: `🪪 '${payload.oldName}' became '${payload.newName}'`
                });
            }),
            messageManager.registerHandler(
                "server:lobby:client:side:changed",
                (_context, payload) => {
                    console.info(`*** Client joined '${payload.newSide?.name ?? "null"}'`);
                    if (payload.newSide && !payload.oldSide) {
                        addLogEntry({
                            text: `➡️ '${payload.client.name}' joined '${payload.newSide?.name}'`
                        });
                    } else if (payload.oldSide && !payload.newSide) {
                        addLogEntry({
                            text: `⬅️ '${payload.client.name}' left '${payload.oldSide?.name}'`
                        });
                    } else if (payload.oldSide && payload.newSide) {
                        addLogEntry({
                            text: `🔀 '${payload.client.name}' left '${payload.oldSide?.name}' and joined '${payload.newSide?.name}'`
                        });
                    }
                }
            ),
            messageManager.registerHandler("server:lobby:client:ready", (_context, payload) => {
                if (payload.ready) {
                    console.info(`*** Client ${payload.client.name} is ready!`);
                    addLogEntry({ text: `🟢 '${payload.client.name} is ready!` });
                } else {
                    console.info(`*** Client ${payload.client.name} is not ready`);
                    addLogEntry({ text: `🛑 '${payload.client.name} is not ready` });
                }
            }),
            messageManager.registerHandler("server:lobby:scenario:list", (_context, payload) => {
                console.info("Scenarios", payload.scenarios);
                setScenarios(payload.scenarios);
            }),
            messageManager.registerHandler("server:lobby:scenario:changed", (_context, payload) => {
                if (payload.newScenario && !payload.oldScenario) {
                    addLogEntry({
                        text: `🗺️ '${payload.client.name}' chose '${payload.newScenario?.name}' scenario`
                    });
                } else if (payload.oldScenario && !payload.newScenario) {
                    addLogEntry({
                        text: `🗺️ '${payload.client.name}' cleared '${payload.oldScenario?.name}' scenario`
                    });
                } else if (payload.oldScenario && payload.newScenario) {
                    addLogEntry({
                        text: `🗺️ '${payload.client.name}' changed scenario from '${payload.oldScenario?.name}' to '${payload.newScenario?.name}'`
                    });
                }
            })
        ];

        return () => {
            console.info("Unmounting LobbyPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, setLobbyState, addLogEntry]);

    const onChangeSideId = useCallback(
        (clientId: ClientId, selectedSideId: string) => {
            const sideId = selectedSideId === "None" ? null : selectedSideId;

            console.info("Change Side", clientId, sideId);

            sendMessage({
                type: "client:side:change",
                payload: { clientId, sideId }
            });
        },
        [sendMessage]
    );

    const onChangeReady = useCallback(
        (ready: boolean) => {
            sendMessage({
                type: "client:ready",
                payload: { ready }
            });
        },
        [sendMessage]
    );

    const onChangeScenario = useCallback(
        (scenarioId: ScenarioId | null) => {
            sendMessage({
                type: "client:scenario:change",
                payload: { scenarioId }
            });
        },
        [sendMessage]
    );

    const onStartGame = useCallback(() => {
        sendMessage({ type: "client:lobby:game:start", payload: undefined });
    }, [sendMessage]);

    return {
        lobbyState,
        logEntries,
        scenarios,
        onChangeSideId,
        onChangeReady,
        onChangeScenario,
        onStartGame
    };
}
