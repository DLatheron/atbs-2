import {
    ClientId,
    CreateEditorResponseBody,
    EditorId,
    EditorQueryParams,
    JoinEditorResponseBody,
    parseURLSearchParams
} from "@atbs/shared-data";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorSocket } from "../EditorSocket";
import { useSearchParams } from "react-router-dom";

type CreateEditorOptions = {
    signal?: AbortSignal;
};

type JoinEditorOptions = {
    signal?: AbortSignal;
};

export interface EditorSocketOptions {
    clientId?: ClientId;
    clientName: string;

    onConnected?: (editorSocket: EditorSocket) => void;
    onDisconnected?: (unexpected: boolean) => void;

    onMessage?: (data: unknown) => void;

    createEditorRetryIntervalInMs?: number;
    joinEditorRetryIntervalInMs?: number;
}

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

async function createEditor({
    clientId,
    name,
    options
}: {
    clientId: ClientId;
    name: string;
    options: CreateEditorOptions;
}): Promise<CreateEditorResponseBody> {
    const { signal } = options;

    const res = await fetch("/api/editor/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name }),
        signal
    });

    if (!res.ok) {
        await throwErrorResponse(res);
    }

    const data: unknown = await res.json().catch(() => ({}));
    return CreateEditorResponseBody.parse(data);
}

async function joinEditor({
    editorId,
    clientId,
    name,
    options
}: {
    editorId: EditorId;
    clientId: ClientId;
    name: string;
    options: JoinEditorOptions;
}): Promise<JoinEditorResponseBody> {
    const { signal } = options;

    const res = await fetch("/api/editor/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editorId, clientId, name }),
        signal
    });

    if (!res.ok) {
        await throwErrorResponse(res);
    }

    const data: unknown = await res.json().catch(() => ({}));
    return JoinEditorResponseBody.parse(data);
}

export function useEditorSocket(options: EditorSocketOptions) {
    const {
        clientId,
        clientName,
        onConnected,
        onDisconnected,
        onMessage,
        createEditorRetryIntervalInMs = 2500,
        joinEditorRetryIntervalInMs = 2500
    } = options;

    const [searchParams, setSearchParams] = useSearchParams();
    const validatedSearchParams = parseURLSearchParams(EditorQueryParams, searchParams);
    const { "editor-id": editorId, mode } = validatedSearchParams;

    const [connected, setConnected] = useState(false);

    const editorSocketRef = useRef<EditorSocket>(null);
    const abortControllerRef = useRef<AbortController>(null);
    const connectionGenerationRef = useRef(0);
    const connectAttemptInFlightRef = useRef(false);

    const handleCreateEditorRef = useRef<(clientId: ClientId) => Promise<void>>(async () => {});
    const handleJoinEditorRef = useRef<(editorId: EditorId, clientId: ClientId) => Promise<void>>(
        async () => {}
    );

    const isCurrentConnection = useCallback((generation: number) => {
        return generation === connectionGenerationRef.current;
    }, []);

    const beginConnectAttempt = useCallback(() => {
        connectionGenerationRef.current += 1;
        connectAttemptInFlightRef.current = true;

        abortControllerRef.current?.abort();
        editorSocketRef.current?.disconnect();
        editorSocketRef.current = null;
        setConnected(false);

        return connectionGenerationRef.current;
    }, []);

    const clearConnectAttemptInFlight = useCallback(
        (generation: number) => {
            if (isCurrentConnection(generation)) {
                connectAttemptInFlightRef.current = false;
            }
        },
        [isCurrentConnection]
    );

    const createSocket = useCallback(
        ({
            editorId,
            clientId,
            generation,
            onOpen,
            onClose,
            onMessage,
            signal
        }: {
            editorId: EditorId;
            clientId: ClientId;
            generation: number;
            onOpen: (editorSocket: EditorSocket) => void;
            onClose: (unexpected: boolean) => void;
            onMessage: (data: unknown) => void;
            signal?: AbortSignal;
        }): EditorSocket => {
            if (!editorId || !clientId) {
                throw new Error("editorId and clientId must set to create a socket");
            }

            const editorSocket = new EditorSocket(editorId, clientId);
            console.info("Editor socket created for", editorId, "from", clientId);

            editorSocket.connect({
                onOpen: () => {
                    if (!isCurrentConnection(generation) || signal?.aborted) {
                        return;
                    }

                    onOpen(editorSocket);
                },
                onClose: () => {
                    if (!isCurrentConnection(generation)) {
                        return;
                    }

                    if (signal?.aborted) {
                        onClose(false);
                    } else {
                        onClose(true);
                    }
                },
                onMessage: (data) => {
                    if (!isCurrentConnection(generation)) {
                        return;
                    }

                    onMessage(data);
                },
                signal
            });

            return editorSocket;
        },
        [isCurrentConnection]
    );

    const handleCreateEditor = useCallback(
        async (clientId: ClientId) => {
            console.info("Attempting to create editor");

            const generation = beginConnectAttempt();

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            try {
                const { editorId: createdEditorId } = await createEditor({
                    clientId,
                    name: clientName,
                    options: { signal: abortController.signal }
                });

                if (!isCurrentConnection(generation)) {
                    return;
                }

                setSearchParams((searchParams) => {
                    searchParams.set("editor-id", createdEditorId);
                    return searchParams;
                });
                console.info(`Created editor with id: ${createdEditorId}`);

                const editorSocket = createSocket({
                    editorId: createdEditorId,
                    clientId,
                    generation,
                    onOpen: (editorSocket: EditorSocket) => {
                        console.info("Editor socket connected");
                        setConnected(true);
                        clearConnectAttemptInFlight(generation);
                        onConnected?.(editorSocket);
                    },
                    onClose: (unexpected) => {
                        console.info("Editor socket closed", unexpected && "unexpectedly");
                        setConnected(false);
                        clearConnectAttemptInFlight(generation);
                        onDisconnected?.(unexpected);
                    },
                    onMessage: (data: unknown) => onMessage?.(data),
                    signal: abortController.signal
                });

                if (!isCurrentConnection(generation)) {
                    editorSocket.disconnect();
                    return;
                }

                editorSocketRef.current = editorSocket;
            } catch (error) {
                clearConnectAttemptInFlight(generation);
                if (isCurrentConnection(generation)) {
                    console.error("Failed to create editor because:", error);
                }
                throw error;
            }
        },
        [
            beginConnectAttempt,
            clearConnectAttemptInFlight,
            createSocket,
            isCurrentConnection,
            setSearchParams,
            onConnected,
            onDisconnected,
            onMessage,
            clientName
        ]
    );

    handleCreateEditorRef.current = handleCreateEditor;

    useEffect(() => {
        if (connected || mode !== "create" || !clientId) {
            return;
        }

        let cancelled = false;

        const tryCreateEditor = () => {
            if (cancelled || connectAttemptInFlightRef.current) {
                return;
            }

            handleCreateEditorRef.current(clientId).catch((error) => {
                console.error("Create editor failed with", error);
            });
        };

        const createEditorTimer = window.setInterval(
            tryCreateEditor,
            createEditorRetryIntervalInMs
        );
        tryCreateEditor();

        return () => {
            cancelled = true;
            clearInterval(createEditorTimer);
        };
    }, [connected, clientId, mode, createEditorRetryIntervalInMs]);

    const handleJoinEditor = useCallback(
        async (editorId: EditorId, clientId: ClientId) => {
            console.info("Attempting to join editor");

            const generation = beginConnectAttempt();

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            try {
                const { editorId: joinedEditorId } = await joinEditor({
                    editorId,
                    clientId,
                    name: clientName,
                    options: { signal: abortController.signal }
                });

                if (!isCurrentConnection(generation)) {
                    return;
                }

                setSearchParams((searchParams) => {
                    searchParams.set("editor-id", joinedEditorId);
                    return searchParams;
                });
                console.info(`Joined editor with id: ${joinedEditorId}`);

                const editorSocket = createSocket({
                    editorId: joinedEditorId,
                    clientId,
                    generation,
                    onOpen: (editorSocket: EditorSocket) => {
                        console.info("Editor socket connected");
                        setConnected(true);
                        clearConnectAttemptInFlight(generation);
                        onConnected?.(editorSocket);
                    },
                    onClose: (unexpected) => {
                        console.info("Editor socket closed", unexpected && "unexpectedly");
                        setConnected(false);
                        clearConnectAttemptInFlight(generation);
                        onDisconnected?.(unexpected);
                    },
                    onMessage: (data: unknown) => onMessage?.(data),
                    signal: abortController.signal
                });

                if (!isCurrentConnection(generation)) {
                    editorSocket.disconnect();
                    return;
                }

                editorSocketRef.current = editorSocket;
            } catch (error) {
                clearConnectAttemptInFlight(generation);
                if (isCurrentConnection(generation)) {
                    console.error(`Failed to join editor ${editorId} because:`, error);
                }
                throw error;
            }
        },
        [
            beginConnectAttempt,
            clearConnectAttemptInFlight,
            createSocket,
            isCurrentConnection,
            setSearchParams,
            onConnected,
            onDisconnected,
            onMessage,
            clientName
        ]
    );

    handleJoinEditorRef.current = handleJoinEditor;

    useEffect(() => {
        // Highlander join may omit editor-id; send a placeholder that the server ignores.
        if (connected || mode !== "join" || !clientId) {
            return;
        }

        const joinEditorId = editorId ?? ("XXXX-XXXX" as EditorId);
        let cancelled = false;

        const tryJoinEditor = () => {
            if (cancelled || connectAttemptInFlightRef.current) {
                return;
            }

            handleJoinEditorRef.current(joinEditorId, clientId).catch((error) => {
                console.error("Join editor failed with", error);
            });
        };

        const joinEditorTimer = window.setInterval(tryJoinEditor, joinEditorRetryIntervalInMs);
        tryJoinEditor();

        return () => {
            cancelled = true;
            clearInterval(joinEditorTimer);
        };
    }, [connected, editorId, clientId, mode, joinEditorRetryIntervalInMs]);

    useEffect(() => {
        return () => {
            connectionGenerationRef.current += 1;
            abortControllerRef.current?.abort();

            editorSocketRef.current?.disconnect();
            editorSocketRef.current = null;
        };
    }, []);

    const leaveEditor = useCallback(() => {
        connectionGenerationRef.current += 1;
        connectAttemptInFlightRef.current = false;

        const hadSocket = editorSocketRef.current !== null;

        abortControllerRef.current?.abort();
        editorSocketRef.current?.disconnect();
        editorSocketRef.current = null;

        setSearchParams((searchParams) => {
            searchParams.delete("mode");
            searchParams.delete("editor-id");
            return searchParams;
        });

        setConnected(false);

        if (!hadSocket) {
            onDisconnected?.(false);
        }
    }, [onDisconnected, setSearchParams]);

    return {
        connected,
        editorId,
        createEditor: useCallback(() => {
            if (!clientId) {
                throw new Error("clientId must be set");
            }
            handleCreateEditor(clientId);
        }, [clientId, handleCreateEditor]),
        joinEditor: useCallback(
            (editorId: EditorId) => {
                if (!clientId) {
                    throw new Error("clientId must be set");
                }
                handleJoinEditor(editorId, clientId);
            },
            [clientId, handleJoinEditor]
        ),
        leaveEditor
    };
}
