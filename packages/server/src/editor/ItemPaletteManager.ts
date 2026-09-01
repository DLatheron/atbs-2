import { readdir, readFile } from "fs/promises";
import path from "path";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";
import { ItemPalette, ItemPaletteRecipe } from "./ItemPalette.js";

const ItemPaletteDirectory = "./data/editor";

export class ItemPaletteManager {
    static readonly Logger: Logger = new Logger(
        "ItemPaletteManager",
        config.logLevels?.terrainManager
    );

    private readonly _palettes: Map<string, ItemPalette>;

    constructor() {
        this._palettes = new Map();
    }

    async loadItemPalettes(directory = ItemPaletteDirectory): Promise<void> {
        const directoryContents = await readdir(directory, {
            encoding: "utf-8",
            withFileTypes: true
        });
        const files = directoryContents
            .filter((dirent) => dirent.isFile())
            .filter((dirent) => dirent.name.endsWith(".itempalette.json"))
            .map(({ name }) => name);

        for (const file of files) {
            const fullPath = path.join(directory, file);

            try {
                const fileContents = await readFile(fullPath, "utf-8");
                const rawRecipe = JSON.parse(fileContents);
                const recipe = ItemPaletteRecipe.parse(rawRecipe);
                const palette = new ItemPalette(recipe);

                ItemPaletteManager.Logger.info(`Loaded Item Palette: ${fullPath}`);

                this.add(palette);
            } catch (error) {
                ItemPaletteManager.Logger.error(`ERROR Loading Item Palette: ${file}`, error);
                throw error;
            }
        }
    }

    find(paletteId: string): ItemPalette | undefined {
        return this._palettes.get(paletteId);
    }

    get(paletteId: string): ItemPalette {
        const palette = this.find(paletteId);
        if (!palette) {
            throw new Error(`Item palette ${paletteId} not found`);
        }
        return palette;
    }

    getDefault(): ItemPalette {
        const palette = this.find("items.itempalette");
        if (!palette) {
            throw new Error("Default item palette not found");
        }
        return palette;
    }

    add(palette: ItemPalette) {
        if (this.find(palette.id)) {
            throw new Error(`Item palette ${palette.id} already registered`);
        }

        this._palettes.set(palette.id, palette);
    }

    private static readonly _singleton = new ItemPaletteManager();
    static GetSingleton(): ItemPaletteManager {
        return ItemPaletteManager._singleton;
    }
}
