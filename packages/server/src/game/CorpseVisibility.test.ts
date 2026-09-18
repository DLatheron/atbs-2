import { describe, expect, it, vi } from "vitest";
import { Orientation, TilePos, Vec2 } from "@atbs/maths";
import { OnTarget, VisibilityFilter } from "@atbs/shared-data";
import { DamageCacheManager } from "./DamageCacheManager.js";
import { EventManager } from "./EventManager.js";
import { FurnitureDamageSystem } from "./FurnitureDamageSystem.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { MaterialRecipe } from "./Material.js";
import { broadcastFilteredFireTrace, toStructuralTileUpdate } from "./fireTraceBroadcast.js";
import type { Game } from "./Game.js";
import { Client } from "./Client.js";
import { MessageRouter } from "./MessageRouter.js";
import type { Side } from "./Side.js";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { Unit, UnitRecipe } from "./Unit.js";
import { VisibilityManager } from "./VisibilityManager.js";
import { MapRecipe, WorldMap } from "./WorldMap.js";
import { ImageManager } from "./ImageManager.js";
import { buildUnitDeathAnimation } from "../AnimationDefinitions.js";

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

describe("corpse visibility on death", () => {
    it("keeps the death tile as a POI when converting a unit into a corpse", () => {
        ensureGrass();
        ensureHumanMaterial();

        const itemManager = new ItemManager(new ItemRecipeManager());
        const furnitureManager = new FurnitureManager(
            new FurnitureRecipeManager(),
            new MaterialManager()
        );

        const side = {
            id: "defenders",
            oppositionSideIds: ["attackers"],
            units: [] as Unit[]
        };

        const game = {
            id: "CORPSE-VIS",
            itemManager,
            furnitureManager,
            eventManager: new EventManager(),
            selectedUnit: null,
            maybeEmitSideEliminated: vi.fn()
        } as unknown as Game;

        const visibilityManager = new VisibilityManager(game);
        const removePoi = vi.spyOn(visibilityManager, "removePoi");
        Object.assign(game, { visibilityManager });

        const map = new WorldMap(
            MapRecipe.parse({
                id: "corpse-vis.map",
                name: "Corpse Vis",
                width: 1,
                height: 1,
                tileSize: 100,
                tiles: [[{ terrain: { id: "grass" } }]]
            }),
            game
        );
        Object.assign(game, { map });

        const unit = new Unit(
            UnitRecipe.parse({
                id: "victim.unit",
                name: "Victim",
                description: [{ text: "Test" }],
                attributes: {
                    actionPoints: { max: 10 },
                    constitution: { max: 10 },
                    fitness: { max: 10 },
                    morale: { max: 10 },
                    stamina: { max: 10 },
                    speed: { max: 10 },
                    strength: { max: 10 },
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
                actions: {}
            }),
            { location: { col: 0, row: 0 }, orientation: Orientation.NORTH },
            { side: side as unknown as Side },
            game
        );

        const tile = map.getTile(new TilePos(0, 0));
        tile.addUnit(unit);
        side.units.push(unit);

        expect(tile.interestMasks).toEqual(["defenders"]);

        const damageCache = new DamageCacheManager("CORPSE-VIS");
        const system = new FurnitureDamageSystem(
            damageCache.createRoundInstance(ImageManager.GetSingleton()),
            map.tileSize
        );

        system.onUnitDeath(tile, unit, 100, 0);

        expect(removePoi).not.toHaveBeenCalled();
        expect(tile.units).toHaveLength(0);
        expect(tile.interestMasks).toEqual(["items"]);
        expect(tile.items.some((item) => item.recipeId === "corpse.item")).toBe(true);

        const [placeholder, settle] = [...system.timedUpdates].sort((a, b) => a.timeMs - b.timeMs);
        expect(placeholder.tileByRenderMode.MAP_MODE.some((img) => img.imageId?.startsWith("anim-"))).toBe(
            true
        );
        expect(
            placeholder.tileByRenderMode.MAP_MODE.some((img) => img.imageId === "generic-dead")
        ).toBe(false);
        expect(settle.tileByRenderMode.MAP_MODE.some((img) => img.imageId === "generic-dead")).toBe(
            true
        );
    });

    it("does not strip corpse sprites from fire:trace when the side can still see the tile", () => {
        ensureGrass();
        ensureHumanMaterial();

        const send = vi.fn();
        const itemManager = new ItemManager(new ItemRecipeManager());
        const furnitureManager = new FurnitureManager(
            new FurnitureRecipeManager(),
            new MaterialManager()
        );

        const defenders = {
            id: "defenders",
            oppositionSideIds: ["attackers"],
            units: [] as Unit[],
            canSee: () => true
        };
        const attackers = {
            id: "attackers",
            oppositionSideIds: ["defenders"],
            units: [] as Unit[],
            canSee: () => true
        };

        const game = {
            id: "CORPSE-TRACE",
            itemManager,
            furnitureManager,
            eventManager: new EventManager(),
            selectedUnit: null,
            maybeEmitSideEliminated: vi.fn(),
            sides: [attackers, defenders],
            syncUnitsCanSee: vi.fn(),
            getSide: (id: string) => (id === "attackers" ? attackers : defenders)
        } as unknown as Game;

        const visibilityManager = new VisibilityManager(game);
        Object.assign(game, {
            visibilityManager,
            visibilityManagerUpdate: vi.fn()
        });
        vi.spyOn(visibilityManager, "update").mockImplementation(() => undefined);

        const map = new WorldMap(
            MapRecipe.parse({
                id: "corpse-trace.map",
                name: "Corpse Trace",
                width: 1,
                height: 1,
                tileSize: 100,
                tiles: [[{ terrain: { id: "grass" } }]]
            }),
            game
        );
        Object.assign(game, { map });

        const clients = [
            new Client({ id: "c-a", name: "A" }, game),
            new Client({ id: "c-d", name: "D" }, game)
        ];
        clients[0].sideId = "attackers";
        clients[1].sideId = "defenders";
        vi.spyOn(clients[0], "sendMessage").mockImplementation((message) => {
            send(message, "attackers");
        });
        vi.spyOn(clients[1], "sendMessage").mockImplementation((message) => {
            send(message, "defenders");
        });
        Object.assign(game, {
            messageRouter: new MessageRouter(["attackers", "defenders"], clients, () => true),
            hearingManager: { emitNoise: vi.fn() }
        });

        const unit = new Unit(
            UnitRecipe.parse({
                id: "victim.unit",
                name: "Victim",
                description: [{ text: "Test" }],
                attributes: {
                    actionPoints: { max: 10 },
                    constitution: { max: 10 },
                    fitness: { max: 10 },
                    morale: { max: 10 },
                    stamina: { max: 10 },
                    speed: { max: 10 },
                    strength: { max: 10 },
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
                actions: {}
            }),
            { location: { col: 0, row: 0 }, orientation: Orientation.NORTH },
            { side: defenders as unknown as Side },
            game
        );

        const tile = map.getTile(new TilePos(0, 0));
        tile.addUnit(unit);
        defenders.units.push(unit);

        const damageCache = new DamageCacheManager("CORPSE-TRACE");
        const system = new FurnitureDamageSystem(
            damageCache.createRoundInstance(ImageManager.GetSingleton()),
            map.tileSize
        );
        system.onUnitDeath(tile, unit, 50, 0);

        const deaths = system.unitDeaths.map(buildUnitDeathAnimation);
        const tileUpdates = [...system.timedUpdates];

        broadcastFilteredFireTrace({
            game,
            payload: {
                tracers: [],
                isOnTarget: OnTarget.enum.onTarget,
                tileUpdates,
                deaths,
                hitSparks: [],
                animations: [],
                animObjects: [],
                animObjectRemovals: []
            },
            actingSideId: "attackers",
            originWorldPos: new Vec2(50, 50),
            originTilePos: new TilePos(0, 0)
        });

        const defenderTrace = send.mock.calls.find(
            ([message, sideId]) => sideId === "defenders" && message.type === "server:fire:trace"
        )?.[0];

        expect(defenderTrace).toBeDefined();
        const settle = defenderTrace.payload.tileUpdates.find((u: { timeMs: number }) => u.timeMs > 50);
        expect(settle).toBeDefined();
        expect(
            settle.tileByRenderMode.MAP_MODE.some(
                (img: { imageId?: string; visibilityFilter?: string[] }) =>
                    img.imageId === "generic-dead" &&
                    img.visibilityFilter?.includes(VisibilityFilter.enum.visible)
            )
        ).toBe(true);

        // Sanity: structural strip would have removed it.
        const stripped = toStructuralTileUpdate(settle);
        expect(
            stripped.tileByRenderMode.MAP_MODE.some((img) => img.imageId === "generic-dead")
        ).toBe(false);
    });
});
