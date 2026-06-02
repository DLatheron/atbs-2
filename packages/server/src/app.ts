import express, { type Application } from "express";
import { apiRouter } from "./routes/index.js";
import { ScenarioManager } from "./game/ScenarioManager.js";
import { TerrainManager } from "./game/TerrainManager.js";
import { WorldMapManager } from "./game/WorldMapManager.js";
import { ImageManager } from "./game/ImageManager.js";

export async function createApp(): Promise<Application> {
    const app = express();

    app.use(express.json());
    app.use(express.static("public"));
    app.use("/api", apiRouter);

    const imageManager = ImageManager.GetSingleton();
    await imageManager.loadImages();

    const terrainManager = TerrainManager.GetSingleton();
    await terrainManager.loadTerrain();

    const worldMapManager = WorldMapManager.GetSingleton();
    await worldMapManager.loadWorldMaps();

    const scenarioManager = new ScenarioManager();
    await scenarioManager.loadScenarios();

    app.locals.imageManager = imageManager;
    app.locals.terrainManager = terrainManager;
    app.locals.worldMapManager = worldMapManager;
    app.locals.scenarioManager = scenarioManager;

    return app;
}
