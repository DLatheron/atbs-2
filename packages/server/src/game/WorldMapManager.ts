import { WorldMapId } from "@atbs/shared-data";
import { readdir, readFile } from "fs/promises";
import { WorldMap, WorldMapRecipe } from "./WorldMap.js";
import path from "path";

const WorldMapDirectory = "./data/maps";

export class WorldMapManager {
    private readonly _mapLookup: Map<WorldMapId, WorldMap>;

    constructor() {
        this._mapLookup = new Map<WorldMapId, WorldMap>();
    }

    async loadWorldMaps(directory = WorldMapDirectory): Promise<void> {
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
                const recipe = WorldMapRecipe.parse(rawRecipe);
                const worldMap = new WorldMap(recipe);

                console.info(`Loaded World Map: ${fullPath}`);

                this.add(worldMap);
            } catch (error) {
                console.error(`ERROR Loading World Map: ${file}`, error);
            }
        }
    }

    find(worldMapId: WorldMapId): WorldMap | undefined {
        return this._mapLookup.get(worldMapId);
    }

    get(worldMapId: WorldMapId): WorldMap {
        const scenario = this.find(worldMapId);
        if (!scenario) {
            throw new Error(`Map ${worldMapId} not found`);
        }
        return scenario;
    }

    has(worldMapId: WorldMapId): boolean {
        return !!this.find(worldMapId);
    }

    add(worldMap: WorldMap) {
        if (this.find(worldMap.id)) {
            throw new Error(`Map ${worldMap.id} already registered`);
        }

        this._mapLookup.set(worldMap.id, worldMap);
    }

    remove(worldMapId: WorldMapId): boolean {
        return this.remove(worldMapId);
    }

    private static readonly _singleton = new WorldMapManager();
    static GetSingleton(): WorldMapManager {
        return WorldMapManager._singleton;
    }
}
