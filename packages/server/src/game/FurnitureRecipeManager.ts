import { FurnitureId } from "@atbs/shared-data";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { FurnitureRecipe } from "./Furniture.js";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";

const FurnitureDirectory = "./data/furniture";

export class FurnitureRecipeManager {
    static readonly Logger: Logger = new Logger(
        "FurnitureRecipeManager",
        config.logLevels?.furnitureRecipeManager
    );

    private readonly _furnitureRecipeMap = new Map<FurnitureId, FurnitureRecipe>();

    constructor() {
        this._furnitureRecipeMap = new Map<FurnitureId, FurnitureRecipe>();
    }

    async loadFurnitureRecipes(directory = FurnitureDirectory): Promise<void> {
        const directoryContents = await readdir(directory, {
            encoding: "utf-8",
            withFileTypes: true
        });
        const files = directoryContents
            .filter((dirent) => dirent.isFile())
            .filter((dirent) => path.extname(dirent.name).toLowerCase() === ".json")
            .map(({ name }) => name);

        for (const file of files) {
            const fullPath = path.join(directory, file);

            try {
                const fileContents = await readFile(fullPath, "utf-8");
                const rawRecipe = JSON.parse(fileContents);
                const recipe = FurnitureRecipe.parse(rawRecipe);

                FurnitureRecipeManager.Logger.info(`Loaded Furniture recipe: ${fullPath}`);

                this.addRecipe(recipe);
            } catch (error) {
                FurnitureRecipeManager.Logger.error(
                    `ERROR Loading Furniture recipe: ${file}`,
                    error
                );
                throw error;
            }
        }
    }

    findRecipe(furnitureId: FurnitureId): FurnitureRecipe | undefined {
        return this._furnitureRecipeMap.get(furnitureId);
    }

    getRecipe(furnitureId: FurnitureId): FurnitureRecipe {
        const scenario = this.findRecipe(furnitureId);
        if (!scenario) {
            throw new Error(`Furniture recipe ${furnitureId} not found`);
        }
        return scenario;
    }

    hasRecipe(furnitureId: FurnitureId): boolean {
        return !!this.findRecipe(furnitureId);
    }

    addRecipe(furnitureRecipe: FurnitureRecipe) {
        if (this.findRecipe(furnitureRecipe.id)) {
            throw new Error(`Furniture recipe ${furnitureRecipe.id} already registered`);
        }

        this._furnitureRecipeMap.set(furnitureRecipe.id, furnitureRecipe);
    }

    removeRecipe(furnitureId: FurnitureId): boolean {
        return this.removeRecipe(furnitureId);
    }

    private static readonly _singleton = new FurnitureRecipeManager();
    static GetSingleton(): FurnitureRecipeManager {
        return FurnitureRecipeManager._singleton;
    }
}
