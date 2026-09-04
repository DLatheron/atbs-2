import { readdir, readFile } from "fs/promises";
import path from "path";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";
import { Blend, BlendRecipe } from "./Blend.js";

const BlendDirectory = "./data/blend";

export class BlendManager {
    static readonly Logger: Logger = new Logger("BlendManager", config.logLevels?.terrainManager);

    private readonly _blendMap: Map<string, Blend>;

    constructor() {
        this._blendMap = new Map();
    }

    async loadBlends(directory = BlendDirectory): Promise<void> {
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
                const recipe = BlendRecipe.parse(rawRecipe);
                const blend = new Blend(recipe);

                BlendManager.Logger.info(`Loaded Blend: ${fullPath}`);

                this.add(blend);
            } catch (error) {
                BlendManager.Logger.error(`ERROR Loading Blend: ${file}`, error);
                throw error;
            }
        }
    }

    find(blendId: string): Blend | undefined {
        return this._blendMap.get(blendId);
    }

    get(blendId: string): Blend {
        const blend = this.find(blendId);
        if (!blend) {
            throw new Error(`Blend ${blendId} not found`);
        }
        return blend;
    }

    has(blendId: string): boolean {
        return !!this.find(blendId);
    }

    add(blend: Blend) {
        if (this.find(blend.id)) {
            throw new Error(`Blend ${blend.id} already registered`);
        }

        this._blendMap.set(blend.id, blend);
    }

    getAll(): Blend[] {
        return [...this._blendMap.values()];
    }

    private static readonly _singleton = new BlendManager();
    static GetSingleton(): BlendManager {
        return BlendManager._singleton;
    }
}
