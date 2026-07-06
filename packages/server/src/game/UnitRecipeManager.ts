import { UnitId } from "@atbs/shared-data";
import { Unit, UnitAdditionalData, UnitOverrides, UnitRecipe } from "./Unit.js";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { ItemManager } from "./ItemManager.js";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";

const UnitDirectory = "./data/units";

export class UnitRecipeManager {
    static readonly Logger: Logger = new Logger(
        "UnitRecipeManager",
        config.logLevels?.unitRecipeManager
    );

    private readonly _unitRecipeMap = new Map<UnitId, UnitRecipe>();

    constructor() {
        this._unitRecipeMap = new Map<UnitId, UnitRecipe>();
    }

    newUnit(
        unitId: UnitId,
        overrides: UnitOverrides,
        additionalData: UnitAdditionalData,
        itemManager: ItemManager
    ): Unit {
        const unitRecipe = this.getRecipe(unitId);

        return new Unit(unitRecipe, overrides, additionalData, itemManager);
    }

    async loadUnitRecipes(directory = UnitDirectory): Promise<void> {
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
                const recipe = UnitRecipe.parse(rawRecipe);

                UnitRecipeManager.Logger.info(`Loaded Unit recipe: ${fullPath}`);

                this.addRecipe(recipe);
            } catch (error) {
                UnitRecipeManager.Logger.error(`ERROR Loading Unit recipe: ${file}`, error);
                throw error;
            }
        }
    }

    findRecipe(unitId: UnitId): UnitRecipe | undefined {
        return this._unitRecipeMap.get(unitId);
    }

    getRecipe(unitId: UnitId): UnitRecipe | never {
        const scenario = this.findRecipe(unitId);
        if (!scenario) {
            throw new Error(`Unit recipe ${unitId} not found`);
        }
        return scenario;
    }

    hasRecipe(unitId: UnitId): boolean {
        return !!this.findRecipe(unitId);
    }

    addRecipe(unitRecipe: UnitRecipe) {
        if (this.findRecipe(unitRecipe.id)) {
            throw new Error(`Unit recipe ${unitRecipe.id} already registered`);
        }

        this._unitRecipeMap.set(unitRecipe.id, unitRecipe);
    }

    removeRecipe(unitId: UnitId): boolean {
        return this._unitRecipeMap.delete(unitId);
    }

    private static readonly _singleton = new UnitRecipeManager();
    static GetSingleton(): UnitRecipeManager {
        return UnitRecipeManager._singleton;
    }
}
