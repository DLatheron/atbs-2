import { Logger } from "@atbs/misc";
import { config } from "../config/config.schema.js";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { VfxId } from "@atbs/shared-data";
import { VfxRecipe } from "./VfxRecipe.js";

const VfxDirectory = "./data/vfx";

export class VfxRecipeManager {
    static readonly Logger: Logger = new Logger(
        "VfxRecipeManager",
        config.logLevels?.vfxRecipeManager
    );

    private readonly _vfxRecipeMap = new Map<VfxId, VfxRecipe>();

    constructor() {
        this._vfxRecipeMap = new Map<VfxId, VfxRecipe>();
    }

    async loadVfxRecipes(directory = VfxDirectory): Promise<void> {
        const directoryContents = await readdir(directory, {
            encoding: "utf-8",
            withFileTypes: true
        });
        const files = directoryContents
            .filter((dirent) => dirent.isFile())
            .filter((dirent) => path.extname(dirent.name).toLowerCase() === ".json")
            .map(({ name }) => name);

        console.info("VfxRecipeManager loading Vfx recipes from", directory, files);
        for (const file of files) {
            const fullPath = path.join(directory, file);

            try {
                const fileContents = await readFile(fullPath, "utf-8");
                const rawRecipe = JSON.parse(fileContents);
                const recipe = VfxRecipe.parse(rawRecipe);

                VfxRecipeManager.Logger.info(`Loaded Vfx recipe: ${fullPath}`);

                this.addRecipe(recipe);
            } catch (error) {
                VfxRecipeManager.Logger.error(`ERROR Loading Vfx recipe: ${file}`, error);
                console.error(error);
                throw error;
            }
        }
    }

    findRecipe(vfxId: VfxId): VfxRecipe | undefined {
        return this._vfxRecipeMap.get(vfxId);
    }

    getRecipe(vfxId: VfxId): VfxRecipe | never {
        const recipe = this.findRecipe(vfxId);
        if (!recipe) {
            throw new Error(`Vfx recipe ${vfxId} not found`);
        }
        return recipe;
    }

    hasRecipe(vfxId: VfxId): boolean {
        return !!this.findRecipe(vfxId);
    }

    addRecipe(vfxRecipe: VfxRecipe) {
        if (this.findRecipe(vfxRecipe.id)) {
            throw new Error(`Vfx recipe ${vfxRecipe.id} already registered`);
        }

        this._vfxRecipeMap.set(vfxRecipe.id, vfxRecipe);
    }

    removeRecipe(vfxId: VfxId): boolean {
        return this._vfxRecipeMap.delete(vfxId);
    }

    private static readonly _singleton = new VfxRecipeManager();
    static GetSingleton(): VfxRecipeManager {
        return VfxRecipeManager._singleton;
    }
}
