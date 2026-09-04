import {
    CreateEditorRequestBody,
    CreateEditorResponseBody,
    ErrorResponseBody
} from "@atbs/shared-data";
import type { Request, RequestHandler, Response } from "express";
import { Editor } from "../../../editor/Editor.js";
import { editorManager } from "../../../editor/EditorManager.js";
import { config } from "../../../config/config.schema.js";

export type CreateEditorRequest = Request<unknown, CreateEditorRequestBody>;
export type CreateEditorResponse = Response<CreateEditorResponseBody | ErrorResponseBody>;

export const createEditor: RequestHandler = async (
    req: CreateEditorRequest,
    res: CreateEditorResponse
) => {
    const parsedBody = CreateEditorRequestBody.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({ error: `invalid payload: ${parsedBody.error.toString()}` });
        return;
    }
    const { clientId, name } = parsedBody.data;

    if (config.highlanderEditorMode) {
        const onlyEditorId = editorManager.findOnlyEditor();
        if (onlyEditorId) {
            const existingEditor = editorManager.findEditor(onlyEditorId);
            if (existingEditor) {
                const client = existingEditor.addClient(clientId, name);
                if (!client) {
                    res.status(501).json({ error: "Failed to add client to existing editor" });
                    return;
                }

                res.json({ editorId: existingEditor.editorId });
                return;
            }
        }

        editorManager.killAllEditors();
    }

    const editor = new Editor(
        clientId,
        req.app.locals.itemRecipeManager,
        req.app.locals.furnitureRecipeManager,
        req.app.locals.materialManager
    );
    const existingEditor = editorManager.findEditor(editor.id);
    if (existingEditor) {
        editorManager.removeEditor(existingEditor.id);
        existingEditor.destroyEditor();
    }

    editorManager.addEditor(editor);

    const client = editor.addClient(clientId, name);
    if (!client) {
        res.status(501).json({ error: "Failed to add client to created editor" });
        return;
    }

    res.json({ editorId: editor.editorId });
};
