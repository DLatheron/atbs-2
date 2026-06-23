import { MapId } from "@atbs/shared-data";
import { readdir, readFile } from "fs/promises";
import { MapRecipe } from "./WorldMap.js";
import path from "path";

const WorldMapDirectory = "./data/maps";

export class MapRecipeManager {
    private readonly _mapLookup: Map<MapId, MapRecipe>;

    constructor() {
        this._mapLookup = new Map<MapId, MapRecipe>();
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
                const mapRecipe = MapRecipe.parse(rawRecipe);

                console.info(`Loaded Map recipe: ${fullPath}`);

                this.add(mapRecipe);
            } catch (error) {
                console.error(`ERROR Loading Map recipe: ${file}`, error);
                throw error;
            }
        }
    }

    find(mapId: MapId): MapRecipe | undefined {
        return this._mapLookup.get(mapId);
    }

    get(mapId: MapId): MapRecipe {
        const scenario = this.find(mapId);
        if (!scenario) {
            throw new Error(`Map ${mapId} not found`);
        }
        return scenario;
    }

    has(worldMapId: MapId): boolean {
        return !!this.find(worldMapId);
    }

    add(mapRecipe: MapRecipe): void {
        if (this.find(mapRecipe.id)) {
            throw new Error(`Map recipe ${mapRecipe.id} already registered`);
        }

        this._mapLookup.set(mapRecipe.id, mapRecipe);
    }

    remove(worldMapId: MapId): boolean {
        return this.remove(worldMapId);
    }

    private static readonly _singleton = new MapRecipeManager();
    static GetSingleton(): MapRecipeManager {
        return MapRecipeManager._singleton;
    }
}
