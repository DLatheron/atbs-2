import { Description, ScenarioSummary, SideId, MapId, ScenarioId } from "@atbs/shared-data";
import z from "zod";
import { Side, SideRecipe } from "./Side.js";
import { MapRecipeManager } from "./MapRecipeManager.js";
import { WorldMap } from "./WorldMap.js";
import type { ItemManager } from "./ItemManager.js";
import type { FurnitureManager } from "./FurnitureManager.js";
import type { VisibilityManager } from "./VisibilityManager.js";

export const ScenarioRecipe = z.object({
    id: ScenarioId,
    name: z.string().nonempty(),
    description: Description,
    worldMapId: MapId,
    sides: z.array(SideRecipe)
});
export type ScenarioRecipe = z.infer<typeof ScenarioRecipe>;

export class Scenario {
    private readonly _recipe: Readonly<ScenarioRecipe>;
    private readonly _sides: Side[];
    private readonly _sidesMap: Map<SideId, Side>;
    private readonly _map: WorldMap;

    constructor(
        recipe: Readonly<ScenarioRecipe>,
        itemManager: ItemManager,
        furnitureManager: FurnitureManager,
        visibilityManager: VisibilityManager
    ) {
        this._recipe = recipe;

        this._sides = recipe.sides.map(
            (sideRecipe) => new Side(sideRecipe, itemManager, visibilityManager)
        );
        this._sidesMap = new Map<SideId, Side>(this._sides.map((side) => [side.id, side]));

        const mapRecipe = MapRecipeManager.GetSingleton().get(recipe.worldMapId);
        this._map = new WorldMap(mapRecipe, itemManager, furnitureManager, visibilityManager);
    }

    get id() {
        return this._recipe.id;
    }

    get name() {
        return this._recipe.name;
    }

    get description() {
        return this._recipe.description;
    }

    get sides(): Side[] {
        return this._sides;
    }

    get needsArmamentPhase() {
        return this.sides.some((side) => side.needsArmamentPhase);
    }

    get needsDeploymentPhase() {
        return this.sides.some((side) => side.needsDeploymentPhase);
    }

    get map(): WorldMap {
        return this._map;
    }

    hasSide(sideId: SideId) {
        return !!this.findSide(sideId);
    }

    findSide(sideId: SideId) {
        return this._sidesMap.get(sideId);
    }

    getSide(sideId: SideId): Side {
        const side = this.findSide(sideId);
        if (!side) {
            throw new Error(`Side ${sideId} not found`);
        }
        return side;
    }

    toScenarioSummary(): ScenarioSummary {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            sides: this._sides.map((side) => ({
                id: side.id,
                name: side.name,
                description: side.description
            }))
        };
    }

    // static async LoadScenario(fullPath: string, itemManager: ItemManager): Promise<Scenario | null> {
    //     try {
    //         const fileContents = await readFile(fullPath, "utf-8");
    //         const rawRecipe = JSON.parse(fileContents);
    //         const recipe = ScenarioRecipe.parse(rawRecipe);

    //         const scenario = new Scenario(recipe, itemManager);

    //         return scenario;
    //     } catch (error) {
    //         console.error(`ERROR Loading Recipe: ${fullPath}`, error);
    //         return null;
    //     }
    // }
}
