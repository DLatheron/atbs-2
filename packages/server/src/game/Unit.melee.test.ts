import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Orientation, TilePos } from "@atbs/maths";
import { ErrorType, ItemType } from "@atbs/shared-data";
import { config } from "../config/config.schema.js";
import { Client } from "./Client.js";
import { EventManager } from "./EventManager.js";
import type { Game } from "./Game.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { MaterialRecipe } from "./Material.js";
import { MessageRouter } from "./MessageRouter.js";
import type { Side } from "./Side.js";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { Unit, UnitRecipe } from "./Unit.js";
import { VisibilityManager } from "./VisibilityManager.js";
import { MapRecipe, WorldMap } from "./WorldMap.js";
import { ItemRecipe } from "./ItemRecipe.js";
import { DamageCacheManager } from "./DamageCacheManager.js";

function ensureGrass(): void {
    const terrainManager = TerrainManager.GetSingleton();
    if (!terrainManager.has("grass")) {
        terrainManager.add(
            new Terrain(
                TerrainRecipe.parse({
                    id: "grass",
                    name: "Grass",
                    category: "terrain",
                    description: [{ text: "Grass" }],
                    renderable: { default: [{ imageId: "grass" }] }
                })
            )
        );
    }
}

function ensureHumanMaterial(): void {
    const materialManager = MaterialManager.GetSingleton();
    if (!materialManager.hasMaterial("human.material")) {
        materialManager.addMaterial(
            MaterialRecipe.parse({
                id: "human.material",
                category: "unit",
                rgb: { r: 248, g: 238, b: 0 },
                densityMap: { default: 3, eyeball: 100 },
                hardness: 0.15,
                toughness: 0.25,
                roughness: 0.0,
                elasticity: 0.0,
                density: 0.2
            })
        );
    }
}

function baseUnitRecipe(id: string, melee?: Record<string, unknown>) {
    return UnitRecipe.parse({
        id,
        name: id,
        description: [{ text: "Test" }],
        isDirectional: true,
        attributes: {
            actionPoints: { max: 100, value: 100 },
            constitution: { max: 50, value: 50 },
            fitness: { max: 80 },
            morale: { max: 80 },
            stamina: { max: 80 },
            speed: { max: 50 },
            strength: { max: 50 },
            weight: 80
        },
        inventory: { inUse: null, items: [] },
        collision: {
            shape: "circle",
            radius: 24,
            materials: ["human.material"]
        },
        renderable: {
            MAP_MODE: {
                alive: { default: { directional: [[], [], [], [], [], [], [], [], []] } },
                dead: [{ imageId: "generic-dead" }],
                default: []
            },
            default: []
        },
        actions: {},
        ...(melee ? { melee } : {})
    });
}

function createHarness() {
    ensureGrass();
    ensureHumanMaterial();

    const itemRecipeManager = new ItemRecipeManager();
    itemRecipeManager.addRecipe(
        ItemRecipe.parse({
            id: "knife.item",
            type: "item",
            name: "Knife",
            description: [{ text: "A combat knife." }],
            weight: 0.25,
            renderable: { default: [{ imageId: "knife" }] },
            melee: { class: "knife", attack: 18, defence: 2, usable: true }
        })
    );

    const itemManager = new ItemManager(itemRecipeManager);
    const furnitureManager = new FurnitureManager(
        new FurnitureRecipeManager(),
        new MaterialManager()
    );

    const attackers = {
        id: "attackers",
        oppositionSideIds: ["defenders"],
        units: [] as Unit[],
        canSee: () => true
    };
    const defenders = {
        id: "defenders",
        oppositionSideIds: ["attackers"],
        units: [] as Unit[],
        canSee: () => true
    };

    const game = {
        id: "MELEE-TEST",
        turn: 0,
        itemManager,
        furnitureManager,
        damageCacheManager: new DamageCacheManager("MELEE-TEST"),
        hearingManager: { emitNoise: vi.fn() },
        sides: [attackers, defenders],
        eventManager: new EventManager(),
        opportunityFireManager: { registerOpportunity: vi.fn() },
        selectedUnit: null as Unit | null,
        getOppositionUnitsForSide: (sideId: string) =>
            sideId === "attackers" ? defenders.units : attackers.units,
        getVisibleOppositionTileUpdates: () => [],
        getZoneIdsAt: () => [] as string[],
        emitItemZoneEvents: vi.fn(),
        emitZoneEntryEvents: vi.fn(),
        maybeEmitSideEliminated: vi.fn(),
        runWithDeferredVictoryMessages: <T>(fn: () => T) => fn(),
        syncUnitsCanSee(callback?: (unit: Unit) => void) {
            for (const side of [attackers, defenders]) {
                for (const unit of side.units) {
                    unit.canSee = unit.getVisibleUnits();
                    callback?.(unit);
                }
            }
        }
    } as unknown as Game;

    const visibilityManager = new VisibilityManager(game);
    Object.assign(game, {
        visibilityManager,
        getSide(sideId: string) {
            const side = [attackers, defenders].find((s) => s.id === sideId);
            if (!side) {
                throw new Error(`Side ${sideId} not found`);
            }
            return side;
        }
    });

    const map = new WorldMap(
        MapRecipe.parse({
            id: "melee-test.map",
            name: "Melee Test",
            width: 3,
            height: 2,
            tileSize: 100,
            tiles: [
                [
                    { terrain: { id: "grass" } },
                    { terrain: { id: "grass" } },
                    { terrain: { id: "grass" } }
                ],
                [
                    { terrain: { id: "grass" } },
                    { terrain: { id: "grass" } },
                    { terrain: { id: "grass" } }
                ]
            ]
        }),
        game
    );
    Object.assign(game, { map });

    const clients = [
        new Client({ id: "client-attackers", name: "Attackers" }, game),
        new Client({ id: "client-defenders", name: "Defenders" }, game)
    ];
    clients[0].sideId = "attackers";
    clients[1].sideId = "defenders";
    const sendSpies = clients.map((client) => vi.spyOn(client, "sendMessage").mockReturnValue());

    const messageRouter = new MessageRouter(["attackers", "defenders"], clients, () => true);
    Object.assign(game, { messageRouter });

    // Attacker south of defender, facing north → forward (NORTH) steps onto defender.
    const attacker = new Unit(
        baseUnitRecipe("attacker.unit", {
            attack: 80,
            defence: 40,
            actionPoints: 25,
            proficiency: { knife: { attack: 1.5 } }
        }),
        { location: { col: 0, row: 1 }, orientation: Orientation.NORTH },
        { side: attackers as unknown as Side },
        game
    );

    const defender = new Unit(
        baseUnitRecipe("defender.unit", { attack: 20, defence: 15, actionPoints: 25 }),
        { location: { col: 0, row: 0 }, orientation: Orientation.NORTH },
        { side: defenders as unknown as Side },
        game
    );

    map.getTile(new TilePos(0, 1)).addUnit(attacker);
    map.getTile(new TilePos(0, 0)).addUnit(defender);
    attackers.units.push(attacker);
    defenders.units.push(defender);

    return { attacker, defender, game, map, sendSpies, itemManager, messageRouter };
}

function messagesOfType(spy: ReturnType<typeof vi.spyOn>, type: string) {
    return spy.mock.calls
        .flatMap(([message]) => (Array.isArray(message) ? message : [message]))
        .filter((message: { type: string }) => message.type === type);
}

describe("Unit melee via move", () => {
    const originalInfiniteActionPoints = config.infiniteActionPoints;

    beforeEach(() => {
        config.infiniteActionPoints = false;
    });

    afterEach(() => {
        config.infiniteActionPoints = originalInfiniteActionPoints;
    });

    it("resolves forward melee and returns the attacker to the start tile", () => {
        const { attacker, defender, map, sendSpies } = createHarness();
        const startAp = attacker.actionPoints;

        attacker.move(Orientation.NORTH); // relative forward → absolute NORTH onto defender

        expect(attacker.mapLocation).toEqual(new TilePos(0, 1));
        expect(map.getTile(new TilePos(0, 1)).units.map((u) => u.id)).toContain(attacker.id);
        expect(map.getTile(new TilePos(0, 0)).units.map((u) => u.id)).toContain(defender.id);
        expect(attacker.actionPoints).toBe(startAp - 25);
        expect(defender.constitution).toBeLessThan(50);

        const fireTraces = messagesOfType(sendSpies[0], "server:fire:trace");
        expect(fireTraces.length).toBeGreaterThan(0);
        expect(fireTraces[0].payload.hitSparks.length).toBeGreaterThan(0);
    });

    it("blocks non-forward moves onto opposition", () => {
        const { attacker, defender, map, game, sendSpies } = createHarness();
        // Place a second defender to the east; sideways move into them must fail.
        const sideDefender = new Unit(
            baseUnitRecipe("side-defender.unit", { attack: 20, defence: 15 }),
            { location: { col: 1, row: 1 }, orientation: Orientation.NORTH },
            { side: defender.side },
            game
        );
        map.getTile(new TilePos(1, 1)).addUnit(sideDefender);
        (defender.side.units as Unit[]).push(sideDefender);

        const startAp = attacker.actionPoints;
        const startHp = sideDefender.constitution;

        attacker.move(Orientation.EAST); // strafe into opposition

        expect(attacker.mapLocation).toEqual(new TilePos(0, 1));
        expect(sideDefender.constitution).toBe(startHp);
        expect(attacker.actionPoints).toBe(startAp);
        expect(
            messagesOfType(sendSpies[0], "server:error").some(
                (m: { payload: string }) => m.payload === ErrorType.enum.UNABLE_TO_MELEE
            )
        ).toBe(true);
    });

    it("blocks melee while overtaking", () => {
        const { attacker, defender, sendSpies } = createHarness();
        vi.spyOn(attacker, "isOvertaking", "get").mockReturnValue(true);

        const startHp = defender.constitution;
        attacker.move(Orientation.NORTH);

        expect(defender.constitution).toBe(startHp);
        expect(
            messagesOfType(sendSpies[0], "server:error").some(
                (m: { payload: string }) => m.payload === ErrorType.enum.UNABLE_TO_MELEE
            )
        ).toBe(true);
    });

    it("blocks melee when holding an unusable bulky item", () => {
        const { attacker, defender, itemManager, sendSpies } = createHarness();
        const corpse = itemManager.newAdHocItem(
            ItemRecipe.parse({
                id: "corpse.item",
                type: ItemType.enum.item,
                name: "Corpse",
                description: [{ text: "Heavy." }],
                weight: 80,
                renderable: { default: [] },
                melee: { class: "improvised", attack: 1, defence: 0, usable: false }
            })
        );
        attacker.inventory.addItem(corpse);
        attacker.inventory.selectItem(corpse);

        const startHp = defender.constitution;
        attacker.move(Orientation.NORTH);

        expect(defender.constitution).toBe(startHp);
        expect(
            messagesOfType(sendSpies[0], "server:error").some(
                (m: { payload: string }) => m.payload === ErrorType.enum.UNABLE_TO_MELEE
            )
        ).toBe(true);
    });

    it("remembers seen enemies across turns for sneak checks", () => {
        const { attacker, defender, game } = createHarness();
        Object.assign(game, { turn: 2 });
        defender.canSee = [attacker];
        expect(defender.turnsSinceSaw(attacker)).toBe(0);

        Object.assign(game, { turn: 3 });
        expect(defender.turnsSinceSaw(attacker)).toBe(1);

        defender.endTurn();
        // memory default 3 — still present at turn 3 with lastSeen 2
        expect(defender.turnsSinceSaw(attacker)).toBe(1);

        Object.assign(game, { turn: 10 });
        defender.endTurn();
        expect(defender.turnsSinceSaw(attacker)).toBeNull();
    });
});
