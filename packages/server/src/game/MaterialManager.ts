import { MaterialId } from "@atbs/shared-data";
import { Material } from "./Material.js";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { MaterialRecipe } from "./Material.js";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";

const MaterialDirectory = "./data/materials";

export class MaterialManager {
    static readonly Logger: Logger = new Logger(
        "MaterialManager",
        config.logLevels?.materialManager
    );

    private readonly _materialMap: Map<MaterialId, Material>;

    constructor() {
        this._materialMap = new Map<MaterialId, Material>();
    }

    async loadMaterials(directory = MaterialDirectory): Promise<void> {
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
                const recipe = MaterialRecipe.parse(rawRecipe);

                MaterialManager.Logger.info(`Loaded Material recipe: ${fullPath}`);

                this.addMaterial(recipe);
            } catch (error) {
                MaterialManager.Logger.error(`ERROR Loading Material recipe: ${file}`, error);
                throw error;
            }
        }
    }

    findMaterial(materialId: MaterialId): Material | undefined {
        return this._materialMap.get(materialId);
    }

    getMaterial(materialId: MaterialId): Material | never {
        const scenario = this.findMaterial(materialId);
        if (!scenario) {
            throw new Error(`Material recipe ${materialId} not found`);
        }
        return scenario;
    }

    hasMaterial(materialId: MaterialId): boolean {
        return !!this.findMaterial(materialId);
    }

    addMaterial(materialRecipe: MaterialRecipe) {
        if (this.findMaterial(materialRecipe.id)) {
            throw new Error(`Material recipe ${materialRecipe.id} already registered`);
        }

        this._materialMap.set(materialRecipe.id, new Material(materialRecipe));
    }

    removeMaterial(materialId: MaterialId): boolean {
        return this._materialMap.delete(materialId);
    }

    private static readonly _singleton = new MaterialManager();
    static GetSingleton(): MaterialManager {
        return MaterialManager._singleton;
    }
}
