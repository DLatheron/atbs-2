import { WorldId } from "@atbs/shared-data";
import { readdir, readFile } from "fs/promises";
import { World, WorldRecipe } from "./World.js";
import path from "path";

const WorldDirectory = "./data/worlds";

export class WorldManager {
    private readonly _mapLookup: Map<WorldId, World>;

    constructor() {
        this._mapLookup = new Map<WorldId, World>();
    }

    async loadWorlds(directory = WorldDirectory): Promise<void> {
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
                const recipe = WorldRecipe.parse(rawRecipe);
                const world = new World(recipe);

                console.info(`Loaded World: ${fullPath}`);

                this.add(world);
            } catch (error) {
                console.error(`ERROR Loading World: ${file}`, error);
            }
        }
    }

    find(worldId: WorldId): World | undefined {
        return this._mapLookup.get(worldId);
    }

    get(worldId: WorldId): World {
        const scenario = this.find(worldId);
        if (!scenario) {
            throw new Error(`Map ${worldId} not found`);
        }
        return scenario;
    }

    has(worldId: WorldId): boolean {
        return !!this.find(worldId);
    }

    add(world: World) {
        if (this.find(world.id)) {
            throw new Error(`Map ${world.id} already registered`);
        }

        this._mapLookup.set(world.id, world);
    }

    remove(worldId: WorldId): boolean {
        return this.remove(worldId);
    }

    private static readonly _singleton = new WorldManager();
    static GetSingleton(): WorldManager {
        return WorldManager._singleton;
    }
}
