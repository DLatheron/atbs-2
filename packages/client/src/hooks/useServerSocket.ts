import {
    ClientId,
    ClientQueryParams,
    CreateGameResponseBody,
    GameId,
    JoinGameResponseBody,
    parseURLSearchParams
} from "@atbs/shared-data";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameSocket } from "../GameSocket";
import { useSearchParams } from "react-router-dom";

type CreateGameOptions = {
    signal?: AbortSignal;
};

type JoinGameOptions = {
    signal?: AbortSignal;
};

export interface ServerSocketOptions {
    clientId?: ClientId;

    onConnected?: (gameSocket: GameSocket) => void;
    onDisconnected?: (unexpected: boolean) => void;

    onMessage?: (data: unknown) => void;

    createGameRetryIntervalInMs?: number;
    joinGameRetryIntervalInMs?: number;
}

/**
 * Throw an error received from the server.
 */
async function throwErrorResponse(res: Response): Promise<never> {
    const data: unknown = await res.json().catch(() => ({}));

    const message =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Request failed (${res.status})`;
    console.error(message);
    throw new Error(message);
}

/**
 * Attempt to create a new game on the server.
 */
async function createGame({
    clientId,
    name,
    options
}: {
    clientId: ClientId;
    name: string;
    options: CreateGameOptions;
}): Promise<CreateGameResponseBody> {
    const { signal } = options;

    const res = await fetch("/api/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name }),
        signal
    });

    if (!res.ok) {
        await throwErrorResponse(res);
    }

    const data: unknown = await res.json().catch(() => ({}));
    const response = CreateGameResponseBody.parse(data);

    return response;
}

/**
 * Attempt to join an existing game on the server.
 */
async function joinGame({
    gameId,
    clientId,
    name,
    options
}: {
    gameId: GameId;
    clientId: ClientId;
    name: string;
    options: JoinGameOptions;
}): Promise<JoinGameResponseBody> {
    const { signal } = options;

    const res = await fetch("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, clientId, name }),
        signal
    });

    if (!res.ok) {
        await throwErrorResponse(res);
    }

    const data: unknown = await res.json().catch(() => ({}));
    const response = CreateGameResponseBody.parse(data);

    return response;
}

export function useServerSocket(options: ServerSocketOptions) {
    const {
        clientId,
        onConnected,
        onDisconnected,
        onMessage,
        createGameRetryIntervalInMs = 2500,
        joinGameRetryIntervalInMs = 2500
    } = options;

    const [searchParams, setSearchParams] = useSearchParams();
    const validatedSearchParams = parseURLSearchParams(ClientQueryParams, searchParams);
    const { "game-id": gameId, mode } = validatedSearchParams;
    const [clientName] = useState<string>(
        mode === "join" ? "Joining client" : mode === "create" ? "Creating client" : "Default name"
    );

    const [connected, setConnected] = useState(false);

    const gameSocketRef = useRef<GameSocket>(null);
    const abortControllerRef = useRef<AbortController>(null);

    /**
     * Create a socket to the server.
     */
    const createSocket = useCallback(
        async ({
            gameId,
            clientId,
            onOpen,
            onClose,
            onMessage,
            signal
        }: {
            gameId: GameId;
            clientId: ClientId;
            onOpen: (gameSocket: GameSocket) => void;
            onClose: (unexpected: boolean) => void;
            onMessage: (data: unknown) => void;
            signal?: AbortSignal;
        }): Promise<GameSocket | null> => {
            if (!gameId || !clientId) {
                throw new Error("gameId and clientId must set to create a socket");
            }

            const gameSocket = new GameSocket(gameId, clientId);
            console.info("Socket created for", gameId, "from", clientId);

            gameSocket.connect({
                onOpen: () => {
                    if (!signal?.aborted) {
                        onOpen?.(gameSocket);
                    }
                },
                onClose: () => {
                    if (signal?.aborted) {
                        onClose?.(false);
                    } else {
                        onClose?.(true);
                    }
                },
                onMessage,
                signal
            });

            return gameSocket;
        },
        []
    );

    /**
     * Handle creating a new game.
     */
    const handleCreateGame = useCallback(
        async (clientId: ClientId) => {
            console.info("Attempting to create game");

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            try {
                const { gameId: createdGameId } = await createGame({
                    clientId,
                    name: clientName,
                    options: { signal: abortController.signal }
                });
                setSearchParams((searchParams) => {
                    searchParams.set("game-id", createdGameId);
                    return searchParams;
                });
                console.info(`Created game with id: ${createdGameId}`);

                const gameSocket = await createSocket({
                    gameId: createdGameId,
                    clientId,
                    onOpen: (gameSocket: GameSocket) => {
                        console.info("Socket connected");
                        setConnected(true);
                        onConnected?.(gameSocket);
                    },
                    onClose: (unexpected) => {
                        console.info("Socket closed", unexpected && "unexpectedly");
                        setConnected(false);
                        onDisconnected?.(unexpected);
                    },
                    onMessage: (data: unknown) => onMessage?.(data),
                    signal: abortController.signal
                });
                gameSocketRef.current = gameSocket;
            } catch (error) {
                console.error("Failed to create game because:", error);
                throw error;
            }
        },
        [createSocket, setSearchParams, onConnected, onDisconnected, onMessage, clientName]
    );

    /**
     * Retry logic for creating a new game.
     */
    useEffect(() => {
        let createGameTimer: number;

        if (!connected && mode === "create" && clientId) {
            const createGame = () =>
                handleCreateGame(clientId).then(() => {
                    clearInterval(createGameTimer);
                });

            createGameTimer = window.setInterval(() => {
                createGame();
            }, createGameRetryIntervalInMs);

            createGame();
        }

        return () => {
            clearInterval(createGameTimer);
        };
    }, [connected, clientId, mode, handleCreateGame, createGameRetryIntervalInMs]);

    /**
     * Handle joining an existing game.
     */
    const handleJoinGame = useCallback(
        async (gameId: GameId, clientId: ClientId) => {
            console.info("Attempting to join game");

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            try {
                const { gameId: joinedGameId } = await joinGame({
                    gameId,
                    clientId,
                    name: clientName,
                    options: { signal: abortController.signal }
                });
                setSearchParams((searchParams) => {
                    searchParams.set("game-id", joinedGameId);
                    return searchParams;
                });
                console.info(`Joined game with id: ${joinedGameId}`);

                const gameSocket = await createSocket({
                    gameId: joinedGameId,
                    clientId,
                    onOpen: (gameSocket: GameSocket) => {
                        console.info("Socket connected");
                        setConnected(true);
                        onConnected?.(gameSocket);
                    },
                    onClose: (unexpected) => {
                        console.info("Socket closed", unexpected && "unexpectedly");
                        setConnected(false);
                        onDisconnected?.(unexpected);
                    },
                    onMessage: (data: unknown) => onMessage?.(data),
                    signal: abortController.signal
                });
                gameSocketRef.current = gameSocket;
            } catch (error) {
                console.error(`Failed to join game ${gameId} because:`, error);
                throw error;
            }
        },
        [createSocket, setSearchParams, onConnected, onDisconnected, onMessage, clientName]
    );

    /**
     * Retry logic for joining an existing game.
     */
    useEffect(() => {
        let joinGameTimer: number;

        if (!connected && mode === "join" && clientId && gameId) {
            const joinGame = () => {
                handleJoinGame(gameId, clientId)
                    .then(() => {
                        clearInterval(joinGameTimer);
                    })
                    .catch((error) => {
                        console.error("Join failed with", error);
                    });
            };

            joinGameTimer = window.setInterval(() => {
                joinGame();
            }, joinGameRetryIntervalInMs);

            joinGame();
        }

        return () => {
            clearInterval(joinGameTimer);
        };
    }, [connected, gameId, clientId, mode, handleJoinGame, joinGameRetryIntervalInMs]);

    /**
     * On component unmount: close down the socket safely.
     */
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();

            gameSocketRef.current?.disconnect();
            gameSocketRef.current = null;
        };
    }, []);

    return { connected, gameId, clientName };
}
