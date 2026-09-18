import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { UnitRecipe } from "./Unit.js";
import { ItemRecipe } from "./ItemRecipe.js";

describe("melee recipe loading", () => {
    it("parses all unit recipes with melee defaults", () => {
        const dir = path.resolve("packages/server/data/units");
        for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
            const recipe = UnitRecipe.parse(
                JSON.parse(readFileSync(path.join(dir, file), "utf-8"))
            );
            expect(recipe.melee.attack).toBeGreaterThanOrEqual(0);
            expect(recipe.melee.defence).toBeGreaterThanOrEqual(0);
            expect(recipe.melee.actionPoints).toBeGreaterThan(0);
        }
    });

    it("parses all item recipes including new melee items", () => {
        const dir = path.resolve("packages/server/data/items");
        const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
        expect(files).toContain("knife.item.json");
        expect(files).toContain("baton.item.json");
        for (const file of files) {
            expect(() =>
                ItemRecipe.parse(JSON.parse(readFileSync(path.join(dir, file), "utf-8")))
            ).not.toThrow();
        }
    });
});
