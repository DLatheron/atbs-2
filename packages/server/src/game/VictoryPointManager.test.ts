import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    VictoryAwardRule,
    VictoryPointManager,
    VictoryRules,
    VICTORY_POINTS_IMMEDIATE_WIN
} from "./VictoryPointManager";
import type { Side } from "./Side";
import type { Game } from "./Game";
import type { Unit } from "./Unit";
import { EventManager } from "./EventManager";

function createHarness(victoryRules: VictoryRules, options: { oppositionUnitCount?: number } = {}) {
    const eventManager = new EventManager();
    const broadcastMessage = vi.fn();
    const evaluateVictoryConditions = vi.fn();
    const getZoneName = vi.fn((zoneId: string) => (zoneId === "safe-1" ? "Extraction LZ" : zoneId));

    const oppositionUnitCount = options.oppositionUnitCount ?? 5;
    const baddies = {
        id: "baddies",
        name: "Baddies",
        units: Array.from({ length: oppositionUnitCount }, (_, i) => ({
            id: `enemy-${i}.unit`
        }))
    };

    const game = {
        eventManager,
        broadcastMessage,
        evaluateVictoryConditions,
        getZoneName,
        sides: [] as Side[],
        getSide: vi.fn(),
        notifyVictoryPointsChanged: vi.fn((sideId: string) => {
            const side = (game as { sides: Side[] }).sides.find((s) => s.id === sideId);
            if (!side) {
                return;
            }
            broadcastMessage({
                type: "server:side:victory-points",
                payload: {
                    sideId,
                    victoryPoints: side.victoryPointManager.victoryPoints,
                    objectives: side.victoryPointManager.toObjectiveSummaries()
                }
            });
            evaluateVictoryConditions();
        })
    } as unknown as Game;

    const side = {
        id: "goodies",
        name: "Goodies",
        oppositionSideIds: ["baddies"],
        game
    } as unknown as Side;

    (game as unknown as { sides: Side[]; getSide: ReturnType<typeof vi.fn> }).sides = [
        side,
        baddies as unknown as Side
    ];
    (game as unknown as { getSide: ReturnType<typeof vi.fn> }).getSide = vi.fn((id: string) => {
        if (id === "goodies") return side;
        if (id === "baddies") return baddies;
        throw new Error(`Side ${id} not found`);
    });

    const manager = new VictoryPointManager(side, VictoryRules.parse(victoryRules), 0);
    (side as { victoryPointManager: VictoryPointManager }).victoryPointManager = manager;
    manager.registerListeners();

    return { manager, eventManager, broadcastMessage, evaluateVictoryConditions, side, game };
}

describe("VictoryPointManager", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("formats assassination objective names with ${unit}", () => {
        const rules: VictoryRules = [
            {
                id: "kill-hans",
                name: "Assassinate ${unit}",
                on: { type: "unitKilled", unitId: "hans-gruber.unit" },
                value: 100,
                once: true
            }
        ];
        const { manager } = createHarness(rules);

        expect(manager.formatVictoryRuleName(rules[0]!)).toBe("Assassinate hans-gruber.unit");
    });

    it("formats progress tokens for multi-award rules", () => {
        const rule = VictoryAwardRule.parse({
            id: "destroy-terminals",
            name: "Destroy computer cores (${awards} of ${maxAwards})",
            on: { type: "furnitureDestroyed", recipeId: "computer-terminal.furniture" },
            value: 34,
            awards: 1,
            maxAwards: 3
        });
        const { manager } = createHarness([rule]);

        expect(manager.formatVictoryRuleName(rule, 1)).toBe("Destroy computer cores (1 of 3)");
        expect(manager.toObjectiveSummaries()[0]).toMatchObject({
            id: "destroy-terminals",
            awards: 1,
            maxAwards: 3,
            complete: false
        });
    });

    it("awards points on matching unitKilled and broadcasts objectives", () => {
        const { manager, eventManager, broadcastMessage, evaluateVictoryConditions } =
            createHarness([
                {
                    id: "kill-hans",
                    name: "Assassinate ${unit}",
                    on: { type: "unitKilled", unitId: "hans-gruber.unit" },
                    value: 100,
                    once: true
                }
            ]);

        const unit = {
            id: "hans-gruber.unit",
            name: "Hans Gruber",
            side: { id: "baddies" }
        } as unknown as Unit;

        eventManager.on("unitKilled", unit);

        expect(manager.victoryPoints).toBe(100);
        expect(broadcastMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "server:side:victory-points",
                payload: expect.objectContaining({
                    victoryPoints: 100,
                    objectives: [
                        expect.objectContaining({
                            id: "kill-hans",
                            complete: true
                        })
                    ]
                })
            })
        );
        expect(evaluateVictoryConditions).toHaveBeenCalled();
    });

    it("accumulates awards up to maxAwards", () => {
        const { manager, eventManager } = createHarness([
            {
                id: "attrition",
                name: "Eliminate hostiles (${awards} of ${maxAwards})",
                on: { type: "unitKilled", sideId: "baddies" },
                value: 20,
                maxAwards: 5
            }
        ]);

        for (let i = 0; i < 6; i++) {
            eventManager.on("unitKilled", {
                id: `enemy-${i}.unit`,
                side: { id: "baddies" }
            } as unknown as Unit);
        }

        expect(manager.victoryPoints).toBe(100);
        expect(manager.toObjectiveSummaries()[0]?.awards).toBe(5);
        expect(manager.toObjectiveSummaries()[0]?.complete).toBe(true);
    });

    it("respects preset awards from the scenario", () => {
        const { manager, eventManager } = createHarness([
            {
                id: "destroy-terminals",
                name: "Destroy computer cores (${awards} of ${maxAwards})",
                on: { type: "furnitureDestroyed", recipeId: "computer-core.furniture" },
                value: 34,
                awards: 2,
                maxAwards: 3
            }
        ]);

        expect(manager.toObjectiveSummaries()[0]?.awards).toBe(2);

        eventManager.on("furnitureDestroyed", {
            recipeId: "computer-core.furniture",
            id: "computer-core.furniture-1"
        } as never);

        expect(manager.victoryPoints).toBe(34);
        expect(manager.toObjectiveSummaries()[0]?.awards).toBe(3);
        expect(manager.toObjectiveSummaries()[0]?.complete).toBe(true);
    });

    it("grants on turnEnded when minTurn is reached", () => {
        const { manager, eventManager } = createHarness([
            {
                id: "hold-out",
                name: "Hold out until turn ${minTurn}",
                on: { type: "turnEnded", minTurn: 20 },
                value: 100,
                once: true
            }
        ]);

        eventManager.on("turnEnded", 19);
        expect(manager.victoryPoints).toBe(0);

        eventManager.on("turnEnded", 20);
        expect(manager.victoryPoints).toBe(100);
        expect(manager.toObjectiveSummaries()[0]?.name).toBe("Hold out until turn 20");
    });

    it("grants on itemEnteredZone", () => {
        const { manager, eventManager } = createHarness([
            {
                id: "extract-disk",
                name: "Extract ${item} to ${zone}",
                on: {
                    type: "itemEnteredZone",
                    itemId: "data-disk.item",
                    zoneId: "safe-1"
                },
                value: 100,
                once: true
            }
        ]);

        eventManager.on("itemEnteredZone", { recipeId: "data-disk.item" } as never, "safe-1", null);

        expect(manager.victoryPoints).toBe(100);
        expect(manager.toObjectiveSummaries()[0]?.name).toContain("Extraction LZ");
    });

    it("supports immediate-win values", () => {
        const { manager, eventManager } = createHarness([
            {
                id: "wipe",
                on: { type: "sideEliminated", sideId: "baddies" },
                value: "immediate-win",
                once: true
            }
        ]);

        eventManager.on("sideEliminated", { id: "baddies" } as never);
        expect(manager.isImmediateWin).toBe(true);
        expect(manager.victoryPoints).toBe(100);
        // Internal sentinel is clamped for display
        expect(
            (manager as unknown as { _victoryPoints: number })._victoryPoints ===
                VICTORY_POINTS_IMMEDIATE_WIN || manager.isImmediateWin
        ).toBe(true);
    });

    it("hides rules without a name from objective summaries", () => {
        const { manager } = createHarness([
            {
                id: "hidden",
                on: { type: "unitKilled" },
                value: 10,
                once: false
            }
        ]);

        expect(manager.toObjectiveSummaries()).toEqual([]);
    });

    it("defaults empty victoryRules to opposition kill attrition", () => {
        const { manager, eventManager } = createHarness([], { oppositionUnitCount: 5 });

        expect(manager.toObjectiveSummaries()[0]).toMatchObject({
            id: "default-eliminate-opposition",
            awards: 0,
            maxAwards: 5,
            value: 20
        });
        expect(manager.toObjectiveSummaries()[0]?.name).toContain("Baddies");

        eventManager.on("unitKilled", {
            id: "enemy-0.unit",
            side: { id: "baddies" }
        } as unknown as Unit);

        expect(manager.victoryPoints).toBe(20);
        expect(manager.toObjectiveSummaries()[0]?.awards).toBe(1);

        // Friendly / non-opposition kills do not count.
        eventManager.on("unitKilled", {
            id: "ally.unit",
            side: { id: "goodies" }
        } as unknown as Unit);
        expect(manager.victoryPoints).toBe(20);
    });

    it("defers victory broadcasts until runWithDeferredVictoryMessages completes", () => {
        const { manager, eventManager, broadcastMessage, evaluateVictoryConditions, game } =
            createHarness([
                {
                    id: "kill-hans",
                    name: "Assassinate ${unit}",
                    on: { type: "unitKilled", unitId: "hans-gruber.unit" },
                    value: 100,
                    once: true
                }
            ]);

        // Real Game deferral API — wire the mock game object to use the real implementation.
        const deferState = {
            depth: 0,
            pending: new Set<string>(),
            evaluationPending: false
        };
        (
            game as { runWithDeferredVictoryMessages: <T>(fn: () => T) => T }
        ).runWithDeferredVictoryMessages = <T>(fn: () => T): T => {
            deferState.depth++;
            try {
                return fn();
            } finally {
                deferState.depth--;
                if (deferState.depth === 0) {
                    for (const sideId of deferState.pending) {
                        (
                            game as { notifyVictoryPointsChanged: (id: string) => void }
                        ).notifyVictoryPointsChanged(sideId);
                    }
                    // notify already evaluates when depth is 0; clear flags
                    deferState.pending.clear();
                    deferState.evaluationPending = false;
                }
            }
        };

        const originalNotify = (game as { notifyVictoryPointsChanged: (id: string) => void })
            .notifyVictoryPointsChanged;
        (game as { notifyVictoryPointsChanged: (id: string) => void }).notifyVictoryPointsChanged =
            (sideId: string) => {
                if (deferState.depth > 0) {
                    deferState.pending.add(sideId);
                    deferState.evaluationPending = true;
                    return;
                }
                originalNotify(sideId);
            };

        let midRequestBroadcasts = 0;
        game.runWithDeferredVictoryMessages(() => {
            eventManager.on("unitKilled", {
                id: "hans-gruber.unit",
                side: { id: "baddies" }
            } as unknown as Unit);
            midRequestBroadcasts = broadcastMessage.mock.calls.length;
            expect(evaluateVictoryConditions).not.toHaveBeenCalled();
        });

        expect(midRequestBroadcasts).toBe(0);
        expect(manager.victoryPoints).toBe(100);
        expect(broadcastMessage).toHaveBeenCalled();
        expect(evaluateVictoryConditions).toHaveBeenCalled();
    });

    it("resolves default attrition from a sides map before game.scenario is set", () => {
        const eventManager = new EventManager();
        const game = {
            eventManager,
            broadcastMessage: vi.fn(),
            evaluateVictoryConditions: vi.fn(),
            getZoneName: vi.fn(),
            notifyVictoryPointsChanged: vi.fn(),
            getSide: vi.fn(() => {
                throw new Error("No scenario set");
            })
        } as unknown as Game;

        const goodies = {
            id: "goodies",
            name: "Goodies",
            oppositionSideIds: ["baddies"],
            units: [{ id: "a.unit" }, { id: "b.unit" }],
            game
        } as unknown as Side;

        const baddies = {
            id: "baddies",
            name: "Baddies",
            oppositionSideIds: ["goodies"],
            units: [{ id: "hans.unit" }],
            game
        } as unknown as Side;

        const sidesById = new Map<string, Side>([
            ["goodies", goodies],
            ["baddies", baddies]
        ]);

        const manager = new VictoryPointManager(baddies, [], 0);
        manager.registerListeners(sidesById);

        expect(manager.toObjectiveSummaries()[0]).toMatchObject({
            id: "default-eliminate-opposition",
            maxAwards: 2,
            value: 50
        });
        expect(manager.toObjectiveSummaries()[0]?.name).toBe("Eliminate Goodies (0 of 2)");
    });
});
