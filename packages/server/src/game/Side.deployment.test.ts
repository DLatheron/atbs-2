import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Orientation, TilePos } from "@atbs/maths";
import { ClientToServerMessage, Phase } from "@atbs/shared-data";
import type { WebSocket } from "ws";
import { AnimationRecipeManager } from "./AnimationRecipeManager.js";
import { AUTOMATED_TEST_SCENARIO_ID, bindAutomatedTestScenario } from "./automatedTestScenario.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { Game } from "./Game.js";
import { ImageManager } from "./ImageManager.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { MapRecipeManager } from "./MapRecipeManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { ScenarioRecipeManager } from "./ScenarioRecipeManager.js";
import { Side, SideRecipe } from "./Side.js";
import { TerrainManager } from "./TerrainManager.js";
import { UnitRecipeManager } from "./UnitRecipeManager.js";
import { VfxRecipeManager } from "./VfxRecipeManager.js";
import { VisibilityManager } from "./VisibilityManager.js";
import { WorldMap } from "./WorldMap.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data");

const DEPLOYMENT_SIDE_RECIPE = SideRecipe.parse({
    id: "goodies",
    name: "Goodies",
    description: [{ text: "Test side" }],
    oppositionSideIds: ["baddies"],
    units: [
        {
            id: "captain-smith.unit",
            overrides: {
                location: { col: 6, row: 10 },
                orientation: Orientation.EAST
            }
        },
        {
            id: "corporal-barry.unit",
            overrides: {
                location: { col: 3, row: 3 },
                orientation: Orientation.NORTH
            }
        }
    ],
    phases: {
        armament: { type: "fixed" },
        deployment: {
            type: "manual",
            marker: "deploy-1",
            zones: [
                {
                    name: "Entry Point",
                    minUnits: 1,
                    maxUnits: 1,
                    tiles: [
                        [
                            { col: 0, row: 0 },
                            { width: 2, height: 2 }
                        ]
                    ],
                    orientation: Orientation.EAST
                },
                {
                    name: "Rooftop",
                    tiles: [[{ col: 10, row: 10 }]],
                    orientation: Orientation.SOUTH
                },
                {
                    name: "Alley",
                    tiles: [
                        [
                            { col: 2, row: 2 },
                            { width: 1, height: 4 }
                        ]
                    ],
                    orientation: Orientation.WEST
                }
            ]
        }
    }
});

class FakeSocket {
    readonly readyState = 1;
    readonly sent: unknown[] = [];

    send(data: string) {
        this.sent.push(JSON.parse(data));
    }

    on() {
        return this;
    }

    removeAllListeners() {
        return this;
    }

    close() {}
}

async function settle() {
    for (let tick = 0; tick < 20; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

describe("Side deployment", () => {
    let scenarioRecipeManager: ScenarioRecipeManager;
    let itemRecipeManager: ItemRecipeManager;
    let furnitureRecipeManager: FurnitureRecipeManager;
    let vfxRecipeManager: VfxRecipeManager;
    let materialManager: MaterialManager;
    let mapRecipeManager: MapRecipeManager;

    let game: Game | null = null;

    const goodiesClientId = crypto.randomUUID();
    const baddiesClientId = crypto.randomUUID();

    beforeAll(async () => {
        await ImageManager.GetSingleton().loadImages([
            path.join(dataDir, "terrain"),
            path.join(dataDir, "units"),
            path.join(dataDir, "items"),
            path.join(dataDir, "icons"),
            path.join(dataDir, "furniture"),
            path.join(dataDir, "vfx")
        ]);
        await TerrainManager.GetSingleton().loadTerrain(path.join(dataDir, "terrain"));
        materialManager = MaterialManager.GetSingleton();
        await materialManager.loadMaterials(path.join(dataDir, "materials"));
        mapRecipeManager = MapRecipeManager.GetSingleton();
        await mapRecipeManager.loadWorldMaps(path.join(dataDir, "maps"));
        await UnitRecipeManager.GetSingleton().loadUnitRecipes(path.join(dataDir, "units"));
        await AnimationRecipeManager.GetSingleton().loadAnimationRecipes(
            path.join(dataDir, "animations")
        );

        itemRecipeManager = ItemRecipeManager.GetSingleton();
        await itemRecipeManager.loadItemRecipes(path.join(dataDir, "items"));
        furnitureRecipeManager = FurnitureRecipeManager.GetSingleton();
        await furnitureRecipeManager.loadFurnitureRecipes(path.join(dataDir, "furniture"));
        vfxRecipeManager = VfxRecipeManager.GetSingleton();
        await vfxRecipeManager.loadVfxRecipes(path.join(dataDir, "vfx"));

        scenarioRecipeManager = new ScenarioRecipeManager();
        await scenarioRecipeManager.loadScenarioRecipes(path.join(dataDir, "scenarios"));
    }, 60000);

    afterEach(() => {
        game?.destroyGame();
        game = null;
    });

    function createSideHarness(recipe: SideRecipe = DEPLOYMENT_SIDE_RECIPE) {
        const scenarioRecipe = scenarioRecipeManager.get(AUTOMATED_TEST_SCENARIO_ID);
        const itemManager = new ItemManager(itemRecipeManager);
        const furnitureManager = new FurnitureManager(furnitureRecipeManager, materialManager);

        const mockGame = {
            id: "SIDE-DEP-TEST",
            itemManager,
            furnitureManager,
            furnitureRecipeManager,
            materialManager,
            sides: [] as Side[],
            clients: [],
            messageRouter: { send: vi.fn(), broadcast: vi.fn(), sendIfVisible: vi.fn() },
            getOppositionUnitsForSide: () => [],
            syncUnitsCanSee: () => {}
        } as unknown as Game;

        const visibilityManager = new VisibilityManager(mockGame);
        Object.assign(mockGame, { visibilityManager });

        const map = new WorldMap(mapRecipeManager.get(scenarioRecipe.worldMapId), mockGame);
        Object.assign(mockGame, { map });

        const side = new Side(recipe, mockGame);
        mockGame.sides = [side];

        return { side, map, game: mockGame };
    }

    it("uses zone names in deployment summaries and blocked-reason messages", () => {
        const { side } = createSideHarness();

        for (const unit of side.units) {
            unit.location = null;
        }

        const [entryPoint] = side.toDeploymentZoneSummary();
        expect(entryPoint.name).toBe("Entry Point");

        side.deployUnit("captain-smith.unit", new TilePos(10, 10));

        expect(side.endDeploymentBlockedReasons).toEqual([
            "All units must be deployed",
            "Entry Point must have at least 1 unit"
        ]);

        side.deployUnit("corporal-barry.unit", new TilePos(2, 2));

        expect(side.endDeploymentBlockedReasons).toEqual(["Entry Point must have at least 1 unit"]);

        side.undeployUnit("corporal-barry.unit");
        side.deployUnit("corporal-barry.unit", new TilePos(0, 0));

        expect(side.canEndDeployment).toBe(true);
        expect(side.endDeploymentBlockedReasons).toEqual([]);
    });

    it("commits staged deployment tiles as unit map locations", () => {
        const { side, map, game: harnessGame } = createSideHarness();

        for (const unit of side.units) {
            unit.location = null;
        }

        side.deployUnit("captain-smith.unit", new TilePos(0, 0));
        side.deployUnit("corporal-barry.unit", new TilePos(10, 10));

        side.finalizeDeployment();

        expect(side.getUnit("captain-smith.unit").location).toEqual(new TilePos(0, 0));
        expect(side.getUnit("corporal-barry.unit").location).toEqual(new TilePos(10, 10));

        for (const unit of side.units) {
            map.addUnit(unit);
        }

        expect(map.getTile(new TilePos(0, 0)).topmostUnit?.id).toBe("captain-smith.unit");
        expect(map.getTile(new TilePos(10, 10)).topmostUnit?.id).toBe("corporal-barry.unit");
        expect(harnessGame.map.getTile(new TilePos(6, 10)).topmostUnit).toBeNull();
    });

    it("satisfies zone minUnits before random-deploying remaining units", () => {
        const { side } = createSideHarness();

        for (const unit of side.units) {
            unit.location = null;
        }

        side.randomDeployAll();

        expect(side.canEndDeployment).toBe(true);

        const summary = side.toDeploymentZoneSummary();
        const entryPoint = summary.find((zone) => zone.name === "Entry Point");
        expect(entryPoint?.deployedCount).toBe(1);
    });

    async function startDeploymentPhase() {
        game = new Game(
            goodiesClientId,
            scenarioRecipeManager,
            itemRecipeManager,
            furnitureRecipeManager,
            vfxRecipeManager,
            materialManager
        );

        bindAutomatedTestScenario(game, scenarioRecipeManager);

        const goodiesSocket = new FakeSocket();
        const baddiesSocket = new FakeSocket();

        game.addClient(goodiesClientId, "Goodies")?.assignSocket(
            goodiesSocket as unknown as WebSocket
        );
        game.addClient(baddiesClientId, "Baddies")?.assignSocket(
            baddiesSocket as unknown as WebSocket
        );

        await settle();

        // Skip armament — automated-test scenario uses manual armament on both sides.
        for (const clientId of [goodiesClientId, baddiesClientId]) {
            game!.receiveMessage(
                JSON.stringify({
                    type: "client:armament:end",
                    payload: null
                }) as unknown as MessageEvent,
                game!.getClient(clientId)
            );
        }

        await settle();

        return { game, goodiesSocket, baddiesSocket };
    }

    function send(gameInstance: Game, clientId: string, message: ClientToServerMessage) {
        gameInstance.receiveMessage(
            JSON.stringify(message) as unknown as MessageEvent,
            gameInstance.getClient(clientId)
        );
    }

    it("places deployed units on the map at action phase start", async () => {
        const { game: liveGame, goodiesSocket } = await startDeploymentPhase();

        expect(liveGame.phase).toBe(Phase.enum.deployment);

        send(liveGame, goodiesClientId, {
            type: "client:deployment:deploy",
            payload: { unitId: "captain-smith.unit", tilePos: { col: 0, row: 0 } }
        });
        send(liveGame, goodiesClientId, {
            type: "client:deployment:deploy",
            payload: { unitId: "corporal-barry.unit", tilePos: { col: 10, row: 10 } }
        });
        await settle();

        send(liveGame, goodiesClientId, {
            type: "client:deployment:end",
            payload: null
        });
        await settle();

        expect(liveGame.phase).toBe(Phase.enum.action);

        const goodies = liveGame.getSide("goodies");
        expect(goodies.getUnit("captain-smith.unit").location).toEqual(new TilePos(0, 0));
        expect(goodies.getUnit("corporal-barry.unit").location).toEqual(new TilePos(10, 10));

        expect(liveGame.map.getTile(new TilePos(0, 0)).topmostUnit?.id).toBe("captain-smith.unit");
        expect(liveGame.map.getTile(new TilePos(10, 10)).topmostUnit?.id).toBe(
            "corporal-barry.unit"
        );
        expect(liveGame.map.getTile(new TilePos(6, 10)).topmostUnit).toBeNull();

        const mapMessage = goodiesSocket.sent.find(
            (message) => (message as { type: string }).type === "server:map"
        ) as { payload: { tilesByRenderMode: { MAP_MODE: unknown[][] } } } | undefined;
        expect(mapMessage).toBeDefined();
    });

    it("auto-deploys random sides and leaves manual sides deploying", async () => {
        const { game: liveGame, goodiesSocket, baddiesSocket } = await startDeploymentPhase();

        expect(liveGame.phase).toBe(Phase.enum.deployment);

        const baddies = liveGame.getSide("baddies");
        const hansLocation = baddies.getUnit("hans-gruber.unit").location;
        expect(hansLocation).not.toBeNull();
        expect(hansLocation!.col).toBeGreaterThanOrEqual(12);
        expect(hansLocation!.col).toBeLessThanOrEqual(14);
        expect(hansLocation!.row).toBeGreaterThanOrEqual(8);
        expect(hansLocation!.row).toBeLessThanOrEqual(10);

        const baddiesWait = baddiesSocket.sent
            .filter((message) => (message as { type: string }).type === "server:wait")
            .at(-1) as { payload: { phase: string; sides: { id: string }[] } | null };
        expect(baddiesWait.payload?.phase).toBe(Phase.enum.deployment);
        expect(baddiesWait.payload?.sides.map(({ id }) => id)).toEqual(["goodies"]);

        expect(
            goodiesSocket.sent.some(
                (message) => (message as { type: string }).type === "server:deployment:side:start"
            )
        ).toBe(true);
        expect(
            baddiesSocket.sent.some(
                (message) => (message as { type: string }).type === "server:deployment:side:start"
            )
        ).toBe(false);
    });

    it("throws when random deployment constraints cannot be satisfied", () => {
        const infeasibleRecipe = SideRecipe.parse({
            id: "bad-side",
            name: "Bad Side",
            description: [{ text: "Bad" }],
            oppositionSideIds: ["other"],
            units: [
                { id: "captain-smith.unit", overrides: {} },
                { id: "corporal-barry.unit", overrides: {} }
            ],
            phases: {
                armament: { type: "fixed" },
                deployment: {
                    type: "random",
                    marker: "deploy-1",
                    zones: [
                        {
                            name: "Too Small",
                            minUnits: 2,
                            maxUnits: 2,
                            tiles: [[{ col: 0, row: 0 }]],
                            orientation: Orientation.NORTH
                        }
                    ]
                }
            }
        });

        expect(() => createSideHarness(infeasibleRecipe)).toThrow(
            /minUnits \(2\) exceeds tile count/i
        );
    });
});
