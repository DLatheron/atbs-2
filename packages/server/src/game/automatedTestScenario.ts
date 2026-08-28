import type { Game } from "./Game.js";
import { Scenario } from "./Scenario.js";
import type { ScenarioRecipeManager } from "./ScenarioRecipeManager.js";

/** Scenario recipe reserved for automated tests — not used for manual playtesting. */
export const AUTOMATED_TEST_SCENARIO_ID = "automated-test.scenario";

/**
 * Binds the automated-test scenario before clients connect so lobby auto-setup
 * does not replace it with the manual playtest scenario (`test.scenario`).
 */
export function bindAutomatedTestScenario(
    game: Game,
    scenarioRecipeManager: ScenarioRecipeManager
): void {
    const recipe = scenarioRecipeManager.get(AUTOMATED_TEST_SCENARIO_ID);
    game.scenario = new Scenario(recipe, game);
}
