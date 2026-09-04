import express, { type Application } from "express";
import { apiRouter } from "./routes/index.js";
import { ScenarioRecipeManager } from "./game/ScenarioRecipeManager.js";
import { TerrainManager } from "./game/TerrainManager.js";
import { MapRecipeManager } from "./game/MapRecipeManager.js";
import { ImageManager } from "./game/ImageManager.js";
import { UnitRecipeManager } from "./game/UnitRecipeManager.js";
import { ItemRecipeManager } from "./game/ItemRecipeManager.js";
import { FurnitureRecipeManager } from "./game/FurnitureRecipeManager.js";
import { MaterialManager } from "./game/MaterialManager.js";
import { AnimationRecipeManager } from "./game/AnimationRecipeManager.js";
import { VfxRecipeManager } from "./game/VfxRecipeManager.js";
import { BlendManager } from "./game/BlendManager.js";
import { TerrainPaletteManager } from "./editor/TerrainPaletteManager.js";
import { FurniturePaletteManager } from "./editor/FurniturePaletteManager.js";
import { WallPaletteManager } from "./editor/WallPaletteManager.js";
import { ItemPaletteManager } from "./editor/ItemPaletteManager.js";

export async function createApp(): Promise<Application> {
    const app = express();

    app.use(express.json());
    app.use(express.static("public"));
    app.use("/api", apiRouter);

    const imageManager = ImageManager.GetSingleton();
    await imageManager.loadImages();

    const terrainManager = TerrainManager.GetSingleton();
    await terrainManager.loadTerrain();

    const blendManager = BlendManager.GetSingleton();
    await blendManager.loadBlends();

    const terrainPaletteManager = TerrainPaletteManager.GetSingleton();
    await terrainPaletteManager.loadTerrainPalettes();

    const furniturePaletteManager = FurniturePaletteManager.GetSingleton();
    await furniturePaletteManager.loadFurniturePalettes();

    const wallPaletteManager = WallPaletteManager.GetSingleton();
    await wallPaletteManager.loadWallPalettes();

    const itemPaletteManager = ItemPaletteManager.GetSingleton();
    await itemPaletteManager.loadItemPalettes();

    const materialManager = MaterialManager.GetSingleton();
    await materialManager.loadMaterials();

    const mapRecipeManager = MapRecipeManager.GetSingleton();
    await mapRecipeManager.loadWorldMaps();

    const unitRecipeManager = UnitRecipeManager.GetSingleton();
    await unitRecipeManager.loadUnitRecipes();

    const itemRecipeManager = ItemRecipeManager.GetSingleton();
    await itemRecipeManager.loadItemRecipes();

    const furnitureRecipeManager = FurnitureRecipeManager.GetSingleton();
    await furnitureRecipeManager.loadFurnitureRecipes();

    const animationRecipeManager = AnimationRecipeManager.GetSingleton();
    await animationRecipeManager.loadAnimationRecipes();

    const vfxRecipeManager = VfxRecipeManager.GetSingleton();
    await vfxRecipeManager.loadVfxRecipes();

    const scenarioRecipeManager = new ScenarioRecipeManager();
    await scenarioRecipeManager.loadScenarioRecipes();

    app.locals.imageManager = imageManager;
    app.locals.terrainManager = terrainManager;
    app.locals.blendManager = blendManager;
    app.locals.terrainPaletteManager = terrainPaletteManager;
    app.locals.furniturePaletteManager = furniturePaletteManager;
    app.locals.wallPaletteManager = wallPaletteManager;
    app.locals.materialManager = materialManager;
    app.locals.mapRecipeManager = mapRecipeManager;
    app.locals.unitRecipeManager = unitRecipeManager;
    app.locals.itemRecipeManager = itemRecipeManager;
    app.locals.animationRecipeManager = animationRecipeManager;
    app.locals.vfxRecipeManager = vfxRecipeManager;
    app.locals.furnitureRecipeManager = furnitureRecipeManager;
    app.locals.scenarioRecipeManager = scenarioRecipeManager;

    return app;
}
