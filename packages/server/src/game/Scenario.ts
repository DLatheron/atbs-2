import { Description, ScenarioSummary, SideId } from "@atbs/shared-data";
import z from "zod";
import { Side, SideRecipe } from "./Side.js";
import { readFile } from "fs/promises";

export const ScenarioRecipe = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: Description,
    sides: z.array(SideRecipe)
});
export type ScenarioRecipe = z.infer<typeof ScenarioRecipe>;

export class Scenario {
    private readonly _recipe: ScenarioRecipe;
    private readonly _sides: Side[];
    private readonly _sidesMap: Map<SideId, Side>;

    constructor(recipe: ScenarioRecipe) {
        this._recipe = recipe;

        this._sides = recipe.sides.map((sideRecipe) => new Side(sideRecipe));
        this._sidesMap = new Map<SideId, Side>(this._sides.map((side) => [side.id, side]));
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

    static async LoadScenario(fullPath: string): Promise<Scenario | null> {
        try {
            const fileContents = await readFile(fullPath, "utf-8");
            const rawRecipe = JSON.parse(fileContents);
            const recipe = ScenarioRecipe.parse(rawRecipe);

            const scenario = new Scenario(recipe);

            return scenario;
        } catch (error) {
            console.error(`ERROR Loading Recipe: ${fullPath}`, error);
            return null;
        }
    }
}
