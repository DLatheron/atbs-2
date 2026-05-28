import { ScenarioId, ScenarioSummary } from "@atbs/shared-data";
import { Scenario, ScenarioRecipe } from "./Scenario.js";
import { readdir, readFile } from "fs/promises";
import path from "path";

const ScenarioDirectory = "./data/scenarios";

export class ScenarioManager {
    private readonly _scenarios: Scenario[];
    private readonly _scenarioMap: Map<ScenarioId, Scenario>;

    constructor() {
        this._scenarios = [];
        this._scenarioMap = new Map<ScenarioId, Scenario>();
    }

    async loadScenarios(directory = ScenarioDirectory): Promise<void> {
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
                const recipe = ScenarioRecipe.parse(rawRecipe);
                const scenario = new Scenario(recipe);

                console.info(`Loaded Scenario: ${fullPath}`);

                this.add(scenario);
            } catch (error) {
                console.error(`ERROR Loading Scenario: ${file}`, error);
            }
        }
    }

    find(scenarioId: ScenarioId): Scenario | undefined {
        return this._scenarioMap.get(scenarioId);
    }

    get(scenarioId: ScenarioId): Scenario {
        const scenario = this.find(scenarioId);
        if (!scenario) {
            throw new Error(`Scenario ${scenarioId} not found`);
        }
        return scenario;
    }

    has(scenarioId: ScenarioId): boolean {
        return !!this.find(scenarioId);
    }

    add(scenario: Scenario) {
        if (this.find(scenario.id)) {
            throw new Error(`Scenario ${scenario.id} already registered`);
        }

        this._scenarios.push(scenario);
        this._scenarioMap.set(scenario.id, scenario);
    }

    remove(scenarioId: ScenarioId): boolean {
        return this.remove(scenarioId);
    }

    toScenarioSummaries(): ScenarioSummary[] {
        return this._scenarios.map((scenario) => scenario.toScenarioSummary());
    }
}
