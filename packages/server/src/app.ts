import express, { type Application } from "express";
import { apiRouter } from "./routes/index.js";
import { ScenarioRecipeManager } from "./game/ScenarioRecipeManager.js";
import { TerrainManager } from "./game/TerrainManager.js";
import { MapRecipeManager } from "./game/MapRecipeManager.js";
import { ImageManager } from "./game/ImageManager.js";
import { UnitRecipeManager } from "./game/UnitRecipeManager.js";
import { ItemRecipeManager } from "./game/ItemRecipeManager.js";

export async function createApp(): Promise<Application> {
    const app = express();

    app.use(express.json());
    app.use(express.static("public"));
    app.use("/api", apiRouter);

    const imageManager = ImageManager.GetSingleton();
    await imageManager.loadImages();

    const terrainManager = TerrainManager.GetSingleton();
    await terrainManager.loadTerrain();

    const mapRecipeManager = MapRecipeManager.GetSingleton();
    await mapRecipeManager.loadWorldMaps();

    const unitRecipeManager = UnitRecipeManager.GetSingleton();
    await unitRecipeManager.loadUnitRecipes();

    const itemRecipeManager = ItemRecipeManager.GetSingleton();
    await itemRecipeManager.loadItemRecipes();

    const scenarioRecipeManager = new ScenarioRecipeManager();
    await scenarioRecipeManager.loadScenarioRecipes();

    app.locals.imageManager = imageManager;
    app.locals.terrainManager = terrainManager;
    app.locals.mapRecipeManager = mapRecipeManager;
    app.locals.unitRecipeManager = unitRecipeManager;
    app.locals.itemRecipeManager = itemRecipeManager;
    app.locals.scenarioRecipeManager = scenarioRecipeManager;

    return app;
}
