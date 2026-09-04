import { readdir, readFile } from "fs/promises";
import path from "path";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";
import { TerrainPalette, TerrainPaletteRecipe } from "./TerrainPalette.js";

const TerrainPaletteDirectory = "./data/editor";

export class TerrainPaletteManager {
    static readonly Logger: Logger = new Logger(
        "TerrainPaletteManager",
        config.logLevels?.terrainManager
    );

    private readonly _palettes: Map<string, TerrainPalette>;

    constructor() {
        this._palettes = new Map();
    }

    async loadTerrainPalettes(directory = TerrainPaletteDirectory): Promise<void> {
        const directoryContents = await readdir(directory, {
            encoding: "utf-8",
            withFileTypes: true
        });
        const files = directoryContents
            .filter((dirent) => dirent.isFile())
            .filter((dirent) => dirent.name.endsWith(".terrainpalette.json"))
            .map(({ name }) => name);

        for (const file of files) {
            const fullPath = path.join(directory, file);

            try {
                const fileContents = await readFile(fullPath, "utf-8");
                const rawRecipe = JSON.parse(fileContents);
                const recipe = TerrainPaletteRecipe.parse(rawRecipe);
                const palette = new TerrainPalette(recipe);

                TerrainPaletteManager.Logger.info(`Loaded Terrain Palette: ${fullPath}`);

                this.add(palette);
            } catch (error) {
                TerrainPaletteManager.Logger.error(`ERROR Loading Terrain Palette: ${file}`, error);
                throw error;
            }
        }
    }

    find(paletteId: string): TerrainPalette | undefined {
        return this._palettes.get(paletteId);
    }

    get(paletteId: string): TerrainPalette {
        const palette = this.find(paletteId);
        if (!palette) {
            throw new Error(`Terrain palette ${paletteId} not found`);
        }
        return palette;
    }

    getDefault(): TerrainPalette {
        const palette = this.find("terrain.terrainpalette");
        if (!palette) {
            throw new Error("Default terrain palette not found");
        }
        return palette;
    }

    add(palette: TerrainPalette) {
        if (this.find(palette.id)) {
            throw new Error(`Terrain palette ${palette.id} already registered`);
        }

        this._palettes.set(palette.id, palette);
    }

    private static readonly _singleton = new TerrainPaletteManager();
    static GetSingleton(): TerrainPaletteManager {
        return TerrainPaletteManager._singleton;
    }
}
