import { readdir, readFile } from "fs/promises";
import path from "path";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";
import { WallPalette, WallPaletteRecipe } from "./WallPalette.js";

const WallPaletteDirectory = "./data/editor";

export class WallPaletteManager {
    static readonly Logger: Logger = new Logger(
        "WallPaletteManager",
        config.logLevels?.terrainManager
    );

    private readonly _palettes: Map<string, WallPalette>;

    constructor() {
        this._palettes = new Map();
    }

    async loadWallPalettes(directory = WallPaletteDirectory): Promise<void> {
        const directoryContents = await readdir(directory, {
            encoding: "utf-8",
            withFileTypes: true
        });
        const files = directoryContents
            .filter((dirent) => dirent.isFile())
            .filter((dirent) => dirent.name.endsWith(".wallpalette.json"))
            .map(({ name }) => name);

        for (const file of files) {
            const fullPath = path.join(directory, file);

            try {
                const fileContents = await readFile(fullPath, "utf-8");
                const rawRecipe = JSON.parse(fileContents);
                const recipe = WallPaletteRecipe.parse(rawRecipe);
                const palette = new WallPalette(recipe);

                WallPaletteManager.Logger.info(`Loaded Wall Palette: ${fullPath}`);

                this.add(palette);
            } catch (error) {
                WallPaletteManager.Logger.error(`ERROR Loading Wall Palette: ${file}`, error);
                throw error;
            }
        }
    }

    find(paletteId: string): WallPalette | undefined {
        return this._palettes.get(paletteId);
    }

    get(paletteId: string): WallPalette {
        const palette = this.find(paletteId);
        if (!palette) {
            throw new Error(`Wall palette ${paletteId} not found`);
        }
        return palette;
    }

    getDefault(): WallPalette {
        const palette = this.find("wall.wallpalette");
        if (!palette) {
            throw new Error("Default wall palette not found");
        }
        return palette;
    }

    add(palette: WallPalette) {
        if (this.find(palette.id)) {
            throw new Error(`Wall palette ${palette.id} already registered`);
        }

        this._palettes.set(palette.id, palette);
    }

    private static readonly _singleton = new WallPaletteManager();
    static GetSingleton(): WallPaletteManager {
        return WallPaletteManager._singleton;
    }
}
