import express, { type Application } from "express";
import { apiRouter } from "./routes/index.js";
import { ScenarioManager } from "./game/ScenarioManager.js";
import { TerrainManager } from "./game/TerrainManager.js";
import { WorldManager } from "./game/WorldManager.js";

export async function createApp(): Promise<Application> {
    const app = express();

    app.use(express.json());
    app.use(express.static("public"));
    app.use("/api", apiRouter);

    const terrainManager = TerrainManager.GetSingleton();
    await terrainManager.loadTerrain();

    const worldManager = WorldManager.GetSingleton();
    await worldManager.loadWorlds();

    const scenarioManager = new ScenarioManager();
    await scenarioManager.loadScenarios();

    app.locals.terrainManager = terrainManager;
    app.locals.worldManager = worldManager;
    app.locals.scenarioManager = scenarioManager;

    return app;
}
