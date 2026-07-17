import { Logger } from "@atbs/misc";
import { config } from "../config/config.schema.js";
import { AnimationId, AnimationRecipe } from "@atbs/shared-data";
import { readdir, readFile } from "fs/promises";
import path from "path";

const AnimationDirectory = "./data/animations";

export class AnimationRecipeManager {
    static readonly Logger: Logger = new Logger(
        "VfxRecipeManager",
        config.logLevels?.vfxRecipeManager
    );

    private readonly _animationRecipeMap = new Map<AnimationId, AnimationRecipe>();

    constructor() {
        this._animationRecipeMap = new Map<AnimationId, AnimationRecipe>();
    }

    async loadAnimationRecipes(directory = AnimationDirectory): Promise<void> {
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
                const recipe = AnimationRecipe.parse(rawRecipe);

                AnimationRecipeManager.Logger.info(`Loaded Animation recipe: ${fullPath}`);

                this.addRecipe(recipe);
            } catch (error) {
                AnimationRecipeManager.Logger.error(
                    `ERROR Loading Animation recipe: ${file}`,
                    error
                );
                throw error;
            }
        }
    }

    findRecipe(animationId: AnimationId): AnimationRecipe | undefined {
        return this._animationRecipeMap.get(animationId);
    }

    getRecipe(animationId: AnimationId): AnimationRecipe | never {
        const scenario = this.findRecipe(animationId);
        if (!scenario) {
            throw new Error(`Animation recipe ${animationId} not found`);
        }
        return scenario;
    }

    hasRecipe(animationId: AnimationId): boolean {
        return !!this.findRecipe(animationId);
    }

    addRecipe(animationRecipe: AnimationRecipe) {
        if (this.findRecipe(animationRecipe.id)) {
            throw new Error(`Animation recipe ${animationRecipe.id} already registered`);
        }

        this._animationRecipeMap.set(animationRecipe.id, animationRecipe);
    }

    removeRecipe(animationId: AnimationId): boolean {
        return this._animationRecipeMap.delete(animationId);
    }

    private static readonly _singleton = new AnimationRecipeManager();
    static GetSingleton(): AnimationRecipeManager {
        return AnimationRecipeManager._singleton;
    }
}
