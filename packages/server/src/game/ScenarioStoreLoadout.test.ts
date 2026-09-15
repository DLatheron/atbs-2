import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data");
const unitsDir = path.join(dataDir, "units");
const scenariosDir = path.join(dataDir, "scenarios");

function loadUnitInventories(): Map<string, string[]> {
    const inventories = new Map<string, string[]>();
    for (const file of fs.readdirSync(unitsDir).filter((name) => name.endsWith(".unit.json"))) {
        const recipe = JSON.parse(fs.readFileSync(path.join(unitsDir, file), "utf8")) as {
            id: string;
            inventory: { items: Array<{ id: string }> };
        };
        inventories.set(
            recipe.id,
            recipe.inventory.items.map((item) => item.id)
        );
    }
    return inventories;
}

function countRequired(itemIds: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const itemId of itemIds) {
        counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
    return counts;
}

describe("Scenario store stocks vs default loadouts", () => {
    const inventories = loadUnitInventories();

    const scenarioFiles = fs
        .readdirSync(scenariosDir)
        .filter((name) => name.endsWith(".scenario.json") && !name.includes("editor"));

    for (const scenarioFile of scenarioFiles) {
        it(`${scenarioFile}: each side store can supply every unit default loadout`, () => {
            const scenario = JSON.parse(
                fs.readFileSync(path.join(scenariosDir, scenarioFile), "utf8")
            ) as {
                sides: Array<{
                    id: string;
                    units: Array<{ id: string }>;
                    phases: {
                        armament?: {
                            store?: {
                                items: Array<{ itemId: string; quantity?: number }>;
                            };
                        };
                    };
                }>;
            };

            const shortfalls: string[] = [];

            for (const side of scenario.sides) {
                const storeItems = side.phases.armament?.store?.items;
                if (!storeItems) {
                    continue;
                }

                const stock = new Map(
                    storeItems.map((item) => [item.itemId, item.quantity ?? 1] as const)
                );
                const requiredIds: string[] = [];
                for (const unit of side.units) {
                    const inventory = inventories.get(unit.id);
                    expect(inventory, `missing unit recipe ${unit.id}`).toBeDefined();
                    requiredIds.push(...inventory!);
                }

                for (const [itemId, need] of countRequired(requiredIds)) {
                    const have = stock.get(itemId) ?? 0;
                    if (have < need) {
                        shortfalls.push(`${side.id}: ${itemId} need ${need}, store has ${have}`);
                    }
                }
            }

            expect(shortfalls, shortfalls.join("\n")).toEqual([]);
        });
    }
});
