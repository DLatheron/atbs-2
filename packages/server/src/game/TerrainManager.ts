import { TerrainId } from "@atbs/shared-data";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";

const TerrainDirectory = "./data/terrain";

export class TerrainManager {
    static readonly Logger: Logger = new Logger("TerrainManager", config.logLevels?.terrainManager);

    private readonly _terrainMap: Map<TerrainId, Terrain>;

    constructor() {
        this._terrainMap = new Map<TerrainId, Terrain>();
    }

    async loadTerrain(directory = TerrainDirectory): Promise<void> {
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
                const recipe = TerrainRecipe.parse(rawRecipe);
                const terrain = new Terrain(recipe);

                TerrainManager.Logger.info(`Loaded Terrain: ${fullPath}`);

                this.add(terrain);
            } catch (error) {
                TerrainManager.Logger.error(`ERROR Loading Terrain: ${file}`, error);
                throw error;
            }
        }
    }

    find(terrainId: TerrainId): Terrain | undefined {
        return this._terrainMap.get(terrainId);
    }

    get(terrainId: TerrainId): Terrain {
        const scenario = this.find(terrainId);
        if (!scenario) {
            throw new Error(`Terrain ${terrainId} not found`);
        }
        return scenario;
    }

    has(terrainId: TerrainId): boolean {
        return !!this.find(terrainId);
    }

    add(terrain: Terrain) {
        if (this.find(terrain.id)) {
            throw new Error(`Terrain ${terrain.id} already registered`);
        }

        this._terrainMap.set(terrain.id, terrain);
    }

    remove(terrainId: TerrainId): boolean {
        return this.remove(terrainId);
    }

    private static readonly _singleton = new TerrainManager();
    static GetSingleton(): TerrainManager {
        return TerrainManager._singleton;
    }
}
