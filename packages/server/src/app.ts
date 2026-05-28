import express, { type Application } from "express";
import { apiRouter } from "./routes/index.js";
import { ScenarioManager } from "./game/ScenarioManager.js";

export async function createApp(): Promise<Application> {
    const app = express();

    app.use(express.json());
    app.use("/api", apiRouter);

    const scenarioManager = new ScenarioManager();

    await scenarioManager.loadScenarios();

    app.locals.scenarioManager = scenarioManager;

    return app;
}
