import { useCallback } from "react";
import {
    EditorQueryParams,
    parseURLSearchParams,
    ServerToClientMessage
} from "@atbs/shared-data";
import { Container } from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { useClientId } from "../hooks/useClientId";
import { useEditorMessageManager } from "../hooks/useEditorMessageManager";
import { useEditorSocket } from "../hooks/useEditorSocket";
import { EditorSocket } from "../EditorSocket";
import { EditorServer } from "../hooks/useEditorMessageManager";
import { EditorPage } from "../pages/Editor/EditorPage";

export function EditorApp() {
    const { clientId } = useClientId();
    const [searchParams] = useSearchParams();
    const validatedSearchParams = parseURLSearchParams(EditorQueryParams, searchParams);
    const { name } = validatedSearchParams;
    const clientName = name ?? "Default Editor Client";

    const { messageManager, setEditorSocket } = useEditorMessageManager();

    const onConnected = useCallback(
        (editorSocket: EditorSocket) => {
            setEditorSocket(editorSocket);
        },
        [setEditorSocket]
    );

    const onDisconnected = useCallback(() => {
        setEditorSocket(null);
    }, [setEditorSocket]);

    const onMessage = useCallback(
        (data: unknown) => {
            let message: ServerToClientMessage;

            try {
                const jsonData = String(data);
                const preParsedMessage = JSON.parse(jsonData);
                message = ServerToClientMessage.parse(preParsedMessage);
            } catch (error) {
                console.error("Failed to parse editor server message", data, error);
                return;
            }

            messageManager.enqueueMessage(message, EditorServer);
        },
        [messageManager]
    );

    const { editorId, connected } = useEditorSocket({
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
        <Container maxWidth={false} sx={{ m: 0, p: 0 }} disableGutters>
            <EditorPage visible={connected} editorId={editorId} />
        </Container>
    );
}
