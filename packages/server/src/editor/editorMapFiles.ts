import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EditorMapListEntry } from "@atbs/shared-data";
import { MapRecipe } from "../game/WorldMap.js";

export const EDITOR_SAVES_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../data/editor-saves"
);

function isMapSaveFilename(filename: string): boolean {
    return filename.endsWith(".map.json") && !filename.includes("-markers-");
}

export async function listEditorSavedMaps(): Promise<EditorMapListEntry[]> {
    let filenames: string[] = [];

    try {
        filenames = await readdir(EDITOR_SAVES_DIR);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return [];
        }
        throw error;
    }

    const entries: EditorMapListEntry[] = [];

    for (const filename of filenames.filter(isMapSaveFilename).sort().reverse()) {
        try {
            const fullPath = path.join(EDITOR_SAVES_DIR, filename);
            const raw = JSON.parse(await readFile(fullPath, "utf-8")) as {
                id?: string;
                name?: string;
                width?: number;
                height?: number;
            };

            if (
                typeof raw.id !== "string" ||
                typeof raw.name !== "string" ||
                typeof raw.width !== "number" ||
                typeof raw.height !== "number"
            ) {
                continue;
            }

            entries.push({
                key: filename,
                source: "editor-save",
                id: raw.id,
                name: raw.name,
                width: raw.width,
                height: raw.height,
                filename
            });
        } catch {
            // Skip unreadable / invalid saves.
        }
    }

    return entries;
}

export async function loadEditorSavedMap(filename: string): Promise<MapRecipe> {
    if (
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\") ||
        !isMapSaveFilename(filename)
    ) {
        throw new Error(`Invalid editor save filename: ${filename}`);
    }

    const fullPath = path.join(EDITOR_SAVES_DIR, filename);
    const fileContents = await readFile(fullPath, "utf-8");
    return MapRecipe.parse(JSON.parse(fileContents));
}
