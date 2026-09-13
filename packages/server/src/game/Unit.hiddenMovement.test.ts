import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Orientation, TilePos } from "@atbs/maths";
import { TrackingSpeed } from "@atbs/shared-data";
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

function createHarness() {
    ensureGrass();
    ensureHumanMaterial();

    const itemManager = new ItemManager(new ItemRecipeManager());
    const furnitureManager = new FurnitureManager(
        new FurnitureRecipeManager(),
        new MaterialManager()
    );

    const attackers = {
        id: "attackers",
        oppositionSideIds: ["defenders"],
        units: [] as Unit[],
        // Own-unit tiles are never "seen" via opposition FOW masks.
        canSee: () => false
    };
    const defenders = {
        id: "defenders",
        oppositionSideIds: ["attackers"],
        units: [] as Unit[],
        canSee: () => false
    };

    const game = {
        id: "HM-TEST",
        itemManager,
        furnitureManager,
        sides: [attackers, defenders],
        eventManager: new EventManager(),
        opportunityFireManager: {
            registerOpportunity: vi.fn()
        },
        getOppositionUnitsForSide: () => [],
        getVisibleOppositionTileUpdates: () => [],
        getZoneIdsAt: () => [] as string[],
        emitItemZoneEvents: vi.fn(),
        emitZoneEntryEvents: vi.fn(),
        syncUnitsCanSee(callback?: (unit: Unit) => void) {
            for (const side of [attackers, defenders]) {
                for (const unit of side.units) {
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
            id: "hm-test.map",
            name: "Hidden Movement Test",
            width: 3,
            height: 1,
            tileSize: 100,
            tiles: [
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

    // Real router: canSee always false — proves alwaysInclude, not mock shortcuts.
    const messageRouter = new MessageRouter(["attackers", "defenders"], clients, () => false);
    Object.assign(game, { messageRouter });

    const unit = new Unit(
        UnitRecipe.parse({
            id: "test-unit.unit",
            name: "Test Unit",
            description: [{ text: "Test" }],
            isDirectional: true,
            attributes: {
                actionPoints: { max: 47, value: 47 },
                constitution: { max: 50 },
                fitness: { max: 80 },
                morale: { max: 82 },
                stamina: { max: 60 },
                speed: { max: 50 },
                strength: { max: 52 },
                weight: 85
            },
            inventory: { inUse: null, items: [] },
            collision: {
                shape: "circle",
                radius: 24,
                materials: ["human.material"]
            },
            renderable: { default: [] },
            actions: {}
        }),
        { location: { col: 0, row: 0 }, orientation: Orientation.EAST },
        { side: attackers as unknown as Side },
        game
    );

    const tile = map.getTile(new TilePos(0, 0));
    tile.addUnit(unit);
    attackers.units.push(unit);

    return { unit, messageRouter, sendSpies, clients };
}

function messagesOfType(spy: ReturnType<typeof vi.spyOn>, type: string) {
    return spy.mock.calls
        .flatMap(([message]) => (Array.isArray(message) ? message : [message]))
        .filter((message: { type: string }) => message.type === type);
}

describe("Unit hidden movement own-side updates", () => {
    const originalInfiniteActionPoints = config.infiniteActionPoints;

    beforeEach(() => {
        config.infiniteActionPoints = false;
    });

    afterEach(() => {
        config.infiniteActionPoints = originalInfiniteActionPoints;
    });

    it("sends map:update and camera to the acting side on rotate when FOW canSee is false", () => {
        const { unit, sendSpies } = createHarness();
        const [attackersSend, defendersSend] = sendSpies;

        unit.rotate(Orientation.SOUTH);

        const mapUpdates = messagesOfType(attackersSend, "server:map:update");
        expect(mapUpdates.length).toBeGreaterThan(0);

        const cameras = messagesOfType(attackersSend, "server:camera:move:to");
        expect(cameras).toContainEqual({
            type: "server:camera:move:to",
            payload: {
                target: "tile",
                tilePos: { col: 0, row: 0 },
                trackingSpeed: TrackingSpeed.enum.MEDIUM
            }
        });

        expect(messagesOfType(defendersSend, "server:map:update")).toEqual([]);
        expect(messagesOfType(defendersSend, "server:camera:move:to")).toEqual([]);
    });

    it("sends map:update for src and dst to the acting side on move when FOW canSee is false", () => {
        const { unit, sendSpies } = createHarness();
        const [attackersSend, defendersSend] = sendSpies;

        // Facing EAST; NORTH relative means step east to (1,0).
        unit.move(Orientation.NORTH);

        const mapUpdates = messagesOfType(attackersSend, "server:map:update");
        const updatedTiles = mapUpdates.flatMap(
            (message: { payload: { tilePos: { col: number; row: number } }[] }) =>
                message.payload.map((tile) => `${tile.tilePos.col},${tile.tilePos.row}`)
        );

        expect(updatedTiles).toContain("0,0");
        expect(updatedTiles).toContain("1,0");

        expect(messagesOfType(attackersSend, "server:camera:move:to")).toContainEqual({
            type: "server:camera:move:to",
            payload: {
                target: "tile",
                tilePos: { col: 1, row: 0 },
                trackingSpeed: TrackingSpeed.enum.MEDIUM
            }
        });

        expect(messagesOfType(defendersSend, "server:map:update")).toEqual([]);
        expect(messagesOfType(defendersSend, "server:camera:move:to")).toEqual([]);
    });
});
