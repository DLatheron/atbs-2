import {
    ErrorResponseBody,
    SaveEditorRequestBody,
    SaveEditorResponseBody
} from "@atbs/shared-data";
import type { Request, RequestHandler, Response } from "express";
import { editorManager } from "../../../editor/EditorManager.js";

export type SaveEditorRequest = Request<unknown, SaveEditorRequestBody>;
export type SaveEditorResponse = Response<SaveEditorResponseBody | ErrorResponseBody>;

export const saveEditor: RequestHandler = async (
    req: SaveEditorRequest,
    res: SaveEditorResponse
) => {
    const parsedBody = SaveEditorRequestBody.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({ error: `invalid payload: ${parsedBody.error.toString()}` });
        return;
    }
    const { editorId, clientId } = parsedBody.data;

    const editor = editorManager.findEditor(editorId);
    if (!editor) {
        res.status(404).json({ error: `editor ${editorId} not found` });
        return;
    }

    const client = editor.findClient(clientId);
    if (!client) {
        res.status(403).json({ error: `client ${clientId} is not in editor ${editorId}` });
        return;
    }

    try {
        const result = await editor.saveMap();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to save editor map"
        });
    }
};
