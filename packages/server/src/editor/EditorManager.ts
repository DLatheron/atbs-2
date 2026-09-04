import { EditorId } from "@atbs/shared-data";
import { Editor } from "./Editor.js";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";

export class EditorManager {
    static readonly Logger: Logger = new Logger("EditorManager", config.logLevels?.editorManager);

    private readonly _editors = new Map<EditorId, Editor>();

    addEditor(editor: Editor): void {
        this._editors.set(editor.editorId, editor);
    }

    removeEditor(editorId: string): boolean {
        return this._editors.delete(editorId);
    }

    getEditor(editorId: string): Editor {
        const editor = this.findEditor(editorId);
        if (!editor) {
            throw new Error(`Editor not found: ${editorId}`);
        }
        return editor;
    }

    findEditor(editorId: string): Editor | undefined {
        return this._editors.get(editorId);
    }

    killAllEditors() {
        for (const editor of this._editors.values()) {
            editor.destroyEditor();
        }

        this._editors.clear();

        EditorManager.Logger.info("All editors killed", this._editors);
    }

    findOnlyEditor(): EditorId | undefined {
        return this._editors.values().next().value?.editorId;
    }
}

export const editorManager = new EditorManager();
