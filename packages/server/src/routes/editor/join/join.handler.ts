import {
    ErrorResponseBody,
    JoinEditorRequestBody,
    JoinEditorResponseBody
} from "@atbs/shared-data";
import type { Request, RequestHandler, Response } from "express";
import { editorManager } from "../../../editor/EditorManager.js";
import { config } from "../../../config/config.schema.js";

export type JoinEditorRequest = Request<unknown, JoinEditorRequestBody>;
export type JoinEditorResponse = Response<JoinEditorResponseBody | ErrorResponseBody>;

export const joinEditor: RequestHandler = (req: JoinEditorRequest, res: JoinEditorResponse) => {
    const parsedBody = JoinEditorRequestBody.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({ error: `invalid payload: ${parsedBody.error.toString()}` });
        return;
    }
    const { clientId, name } = parsedBody.data;
    let { editorId } = parsedBody.data;

    if (config.highlanderEditorMode) {
        const onlyEditorId = editorManager.findOnlyEditor();
        if (!onlyEditorId) {
            res.status(500).json({ error: "Unable to find the one and only editor" });
            return;
        }
        editorId = onlyEditorId;
    }

    const editor = editorManager.findEditor(editorId);
    if (!editor) {
        res.status(404).json({ error: `editor ${editorId} not found` });
        return;
    }

    const client = editor.addClient(clientId, name);
    if (!client) {
        res.status(500).json({ error: "Failed to add client to editor" });
        return;
    }

    res.json({ editorId: editor.editorId });
};
