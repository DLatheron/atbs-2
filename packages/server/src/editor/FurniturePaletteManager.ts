import { readdir, readFile } from "fs/promises";
import path from "path";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";
import { FurniturePalette, FurniturePaletteRecipe } from "./FurniturePalette.js";

const FurniturePaletteDirectory = "./data/editor";

export class FurniturePaletteManager {
    static readonly Logger: Logger = new Logger(
        "FurniturePaletteManager",
        config.logLevels?.terrainManager
    );

    private readonly _palettes: Map<string, FurniturePalette>;

    constructor() {
        this._palettes = new Map();
    }

    async loadFurniturePalettes(directory = FurniturePaletteDirectory): Promise<void> {
        const directoryContents = await readdir(directory, {
            encoding: "utf-8",
            withFileTypes: true
        });
        const files = directoryContents
            .filter((dirent) => dirent.isFile())
            .filter((dirent) => dirent.name.endsWith(".furniturepalette.json"))
            .map(({ name }) => name);

        for (const file of files) {
            const fullPath = path.join(directory, file);

            try {
                const fileContents = await readFile(fullPath, "utf-8");
                const rawRecipe = JSON.parse(fileContents);
                const recipe = FurniturePaletteRecipe.parse(rawRecipe);
                const palette = new FurniturePalette(recipe);

                FurniturePaletteManager.Logger.info(`Loaded Furniture Palette: ${fullPath}`);

                this.add(palette);
            } catch (error) {
                FurniturePaletteManager.Logger.error(
                    `ERROR Loading Furniture Palette: ${file}`,
                    error
                );
                throw error;
            }
        }
    }

    find(paletteId: string): FurniturePalette | undefined {
        return this._palettes.get(paletteId);
    }

    get(paletteId: string): FurniturePalette {
        const palette = this.find(paletteId);
        if (!palette) {
            throw new Error(`Furniture palette ${paletteId} not found`);
        }
        return palette;
    }

    getDefault(): FurniturePalette {
        const palette = this.find("furniture.furniturepalette");
        if (!palette) {
            throw new Error("Default furniture palette not found");
        }
        return palette;
    }

    add(palette: FurniturePalette) {
        if (this.find(palette.id)) {
            throw new Error(`Furniture palette ${palette.id} already registered`);
        }

        this._palettes.set(palette.id, palette);
    }

    private static readonly _singleton = new FurniturePaletteManager();
    static GetSingleton(): FurniturePaletteManager {
        return FurniturePaletteManager._singleton;
    }
}
