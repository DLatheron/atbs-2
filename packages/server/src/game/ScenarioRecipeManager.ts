import { ScenarioId, ScenarioSummary } from "@atbs/shared-data";
import { ScenarioRecipe } from "./Scenario.js";
import { readdir, readFile } from "fs/promises";
import path from "path";

const ScenarioDirectory = "./data/scenarios";

export class ScenarioRecipeManager {
    private readonly _scenarioRecipes: ScenarioRecipe[];
    private readonly _scenarioRecipeMap: Map<ScenarioId, ScenarioRecipe>;

    constructor() {
        this._scenarioRecipes = [];
        this._scenarioRecipeMap = new Map<ScenarioId, ScenarioRecipe>();
    }

    async loadScenarioRecipes(directory = ScenarioDirectory): Promise<void> {
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
                const scenarioRecipe = ScenarioRecipe.parse(rawRecipe);

                console.info(`Loaded Scenario recipe: ${fullPath}`);

                this.add(scenarioRecipe);
            } catch (error) {
                console.error(`ERROR Loading Scenario recipe: ${file}`, error);
                throw error;
            }
        }
    }

    find(scenarioId: ScenarioId): ScenarioRecipe | undefined {
        return this._scenarioRecipeMap.get(scenarioId);
    }

    get(scenarioId: ScenarioId): ScenarioRecipe {
        const scenario = this.find(scenarioId);
        if (!scenario) {
            throw new Error(`Scenario ${scenarioId} not found`);
        }
        return scenario;
    }

    has(scenarioId: ScenarioId): boolean {
        return !!this.find(scenarioId);
    }

    add(scenarioRecipe: ScenarioRecipe) {
        if (this.find(scenarioRecipe.id)) {
            throw new Error(`Scenario recipe ${scenarioRecipe.id} already registered`);
        }

        this._scenarioRecipes.push(scenarioRecipe);
        this._scenarioRecipeMap.set(scenarioRecipe.id, scenarioRecipe);
    }

    remove(scenarioId: ScenarioId): boolean {
        return this.remove(scenarioId);
    }

    toScenarioSummaries(): ScenarioSummary[] {
        return this._scenarioRecipes.map((scenario) => ({
            id: scenario.id,
            name: scenario.name,
            description: scenario.description,
            sides: scenario.sides.map((side) => ({
                id: side.id,
                name: side.name,
                description: side.description
            }))
        }));
    }
}
