import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { TilePos, Vec2 } from "@atbs/maths";
import {
    AnimationRecipe,
    FragmentExplosion,
    OnTarget,
    ShockwaveExplosion
} from "@atbs/shared-data";
import { PNG } from "pngjs";
import { config } from "../config/config.schema.js";
import type { Game } from "./Game.js";
import { AnimationRecipeManager } from "./AnimationRecipeManager.js";
import { DamageCacheManager } from "./DamageCacheManager.js";
import {
    consumeExplodedItem,
    detonateExplosion,
    type ExplosionDetonationResult
} from "./ExplosionSystem.js";
import { FurnitureRecipe } from "./Furniture.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { Image } from "./Image.js";
import { ImageManager } from "./ImageManager.js";
import { Inventory } from "./Inventory.js";
import { Item } from "./Item.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipe } from "./ItemRecipe.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { MaterialRecipe } from "./Material.js";
import { PrimeManager } from "./PrimeManager.js";
import { Projectile } from "./Projectile.js";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { TileRecipe } from "./Tile.js";
import type { Unit } from "./Unit.js";
import { Unit } from "./Unit.js";
import { VisibilityManager } from "./VisibilityManager.js";
import { WorldMap, MapRecipe } from "./WorldMap.js";

const WALL_RGB = { r: 107, g: 66, b: 0 };
const UNIT_TYPE = "human";

function createSolidImage(
    id: string,
    size: number,
    rgb: { r: number; g: number; b: number }
): Image {
    const png = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (size * y + x) << 2;
            png.data[idx + 0] = rgb.r;
            png.data[idx + 1] = rgb.g;
            png.data[idx + 2] = rgb.b;
            png.data[idx + 3] = 255;
        }
    }
    return new Image(id, png);
}

function createWallRecipe(): FurnitureRecipe {
    return FurnitureRecipe.parse({
        id: "wall.furniture",
        name: "Wall",
        description: [{ text: "Test wall" }],
        renderable: {
            default: {
                default: [{ imageId: "wall" }],
                destroyed: []
            },
            FIRE_MODE: {
                default: [{ imageId: "wall-cl" }],
                destroyed: []
            }
        },
        materials: ["wood.material"],
        hitPoints: { max: 50 },
        movementObstruction: {
            default: { default: 100 },
            destroyed: { default: 0 }
        }
    });
}

function openTile(): TileRecipe {
    return TileRecipe.parse({ terrain: { id: "grass" } });
}

function wallTile(): TileRecipe {
    return TileRecipe.parse({
        terrain: { id: "grass" },
        furniture: { id: "wall.furniture" }
    });
}

function testFragmentExplosionInput(overrides: Record<string, unknown> = {}) {
    return {
        type: "fragment" as const,
        maxRange: 80,
        numFragments: 8,
        penetration: 5,
        angleJitter: 0,
        variability: { min: 1, max: 1 },
        visual: {
            intensity: 1,
            velocity: 400,
            length: 10,
            rangeFallOff: 10
        },
        damage: { default: 1 },
        ...overrides
    };
}

function testFragmentExplosion(overrides: Record<string, unknown> = {}): FragmentExplosion {
    return FragmentExplosion.parse(testFragmentExplosionInput(overrides));
}

function testShockwaveExplosionInput(overrides: Record<string, unknown> = {}) {
    return {
        type: "shockwave" as const,
        maxRange: 150,
        numFragments: 16,
        penetration: 0,
        angleJitter: 0,
        variability: { min: 1, max: 1 },
        visual: {
            intensity: 1,
            velocity: 500,
            length: 20,
            rangeFallOff: 10
        },
        damage: { type: "disorientation" as const, default: 100 },
        animationId: "shockwave.animation",
        ...overrides
    };
}

function testShockwaveExplosion(overrides: Record<string, unknown> = {}): ShockwaveExplosion {
    return ShockwaveExplosion.parse(testShockwaveExplosionInput(overrides));
}

function ensureShockwaveAnimationRecipe(): void {
    const manager = AnimationRecipeManager.GetSingleton();
    if (manager.hasRecipe("shockwave.animation")) {
        return;
    }

    manager.addRecipe(
        AnimationRecipe.parse({
            id: "shockwave.animation",
            stateDef: {
                scale: [
                    0,
                    [
                        {
                            type: "ease-in",
                            startOffset: 0,
                            powerIn: 4,
                            duration: 1000,
                            toValue: 800
                        }
                    ]
                ],
                opacity: 1,
                renderable: {
                    default: [{ imageId: "shockwave" }]
                }
            }
        })
    );
}

function setupExplosionFixture(gameId: string) {
    const tileSize = 100;
    const tempDir = mkdtempSync(path.join(tmpdir(), "atbs-explosion-"));
    const imageManager = ImageManager.GetSingleton();
    const damageCache = new DamageCacheManager(gameId);

    for (const [id, rgb] of [
        ["wall", WALL_RGB],
        ["wall-cl", WALL_RGB],
        ["grass", { r: 0, g: 128, b: 0 }],
        ["unit-body", { r: 200, g: 50, b: 50 }],
        ["shockwave", { r: 255, g: 255, b: 255 }]
    ] as const) {
        if (!imageManager.exists(id)) {
            imageManager.addImage(id, tempDir, createSolidImage(id, tileSize, rgb));
        }
    }

    ensureShockwaveAnimationRecipe();

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

    const materialManager = new MaterialManager();
    materialManager.addMaterial(
        MaterialRecipe.parse({
            id: "wood.material",
            category: "furniture",
            rgb: WALL_RGB,
            densityMap: { default: 3, eyeball: 100 },
            hardness: 0.15,
            toughness: 0.25,
            roughness: 0.8,
            elasticity: 0.05,
            density: 0.08
        })
    );

    const sharedMaterials = MaterialManager.GetSingleton();
    if (!sharedMaterials.hasMaterial("flesh.material")) {
        sharedMaterials.addMaterial(
            MaterialRecipe.parse({
                id: "flesh.material",
                category: "unit",
                rgb: { r: 200, g: 50, b: 50 },
                densityMap: { default: 1, eyeball: 100 },
                hardness: 0.1,
                toughness: 0.1,
                roughness: 0.5,
                elasticity: 0.1,
                density: 0.05
            })
        );
    }

    const furnitureRecipeManager = new FurnitureRecipeManager();
    furnitureRecipeManager.addRecipe(createWallRecipe());
    const furnitureManager = new FurnitureManager(furnitureRecipeManager, materialManager);

    const itemRecipeManager = new ItemRecipeManager();
    itemRecipeManager.addRecipe(
        ItemRecipe.parse({
            id: "test.frag.grenade",
            type: "grenade",
            name: "Test Frag",
            description: [{ text: "Test" }],
            weight: 0.4,
            renderable: {
                default: [{ imageId: "grass" }],
                FIRE_MODE: []
            },
            explosion: testFragmentExplosionInput()
        })
    );
    itemRecipeManager.addRecipe(
        ItemRecipe.parse({
            id: "test.he.round",
            type: "round",
            name: "Test HE",
            description: [{ text: "Test" }],
            weight: 0.3,
            renderable: {
                default: [{ imageId: "grass" }],
                FIRE_MODE: []
            },
            projectile: {
                maxRange: 500,
                visual: {
                    headColour: { r: 255, g: 255, b: 255, a: 1 },
                    headRadiusInPixels: 2,
                    trailColour: { r: 255, g: 255, b: 255, a: 1 },
                    trailLengthInPixels: 20,
                    rangeFalloffPower: 10
                },
                damage: { default: 1 },
                mass: 0.19,
                velocity: 200,
                diameter: 40,
                hardness: 1,
                shape: 0,
                stability: 1,
                bounce: 0,
                integrity: 0,
                explosion: testFragmentExplosionInput({ numFragments: 6 })
            }
        })
    );
    itemRecipeManager.addRecipe(
        ItemRecipe.parse({
            id: "test.stun.grenade",
            type: "grenade",
            name: "Test Stun",
            description: [{ text: "Test" }],
            weight: 0.37,
            renderable: {
                default: [{ imageId: "grass" }],
                FIRE_MODE: []
            },
            explosion: testShockwaveExplosionInput()
        })
    );
    itemRecipeManager.addRecipe(
        ItemRecipe.parse({
            id: "test.stun.round",
            type: "round",
            name: "Test 40mm Stun",
            description: [{ text: "Test" }],
            weight: 0.3,
            renderable: {
                default: [{ imageId: "grass" }],
                FIRE_MODE: []
            },
            projectile: {
                maxRange: 500,
                visual: {
                    headColour: { r: 255, g: 255, b: 255, a: 1 },
                    headRadiusInPixels: 2,
                    trailColour: { r: 255, g: 255, b: 255, a: 1 },
                    trailLengthInPixels: 20,
                    rangeFalloffPower: 10
                },
                damage: { default: 1 },
                mass: 0.19,
                velocity: 200,
                diameter: 40,
                hardness: 1,
                shape: 0,
                stability: 1,
                bounce: 0,
                integrity: 0,
                explosion: testShockwaveExplosionInput({ numFragments: 12 })
            }
        })
    );

    const itemManager = new ItemManager(itemRecipeManager);
    const sentMessages: unknown[] = [];

    const game = {
        id: gameId,
        furnitureManager,
        itemManager,
        damageCacheManager: damageCache,
        sides: [] as { id: string; units: Unit[]; oppositionSideIds: string[] }[],
        messageRouter: {
            send: (message: unknown) => {
                sentMessages.push(message);
            }
        }
    } as unknown as Game;

    const visibilityManager = new VisibilityManager(game);
    const primeManager = new PrimeManager(game);
    Object.assign(game, { visibilityManager, primeManager, sentMessages });

    return { tileSize, tempDir, imageManager, game, damageCache, itemManager, sentMessages };
}

function teardownExplosionFixture(
    tempDir: string | undefined,
    imageManager: ImageManager | undefined
) {
    if (imageManager) {
        for (const id of ["wall", "wall-cl", "grass", "unit-body", "shockwave"]) {
            if (imageManager.exists(id)) {
                imageManager.removeImage(id);
            }
        }
    }
    if (tempDir && existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
    }
}

function createMap(game: Game, tileSize: number, tiles: TileRecipe[][]): WorldMap {
    const map = new WorldMap(
        MapRecipe.parse({
            id: "explosion.map",
            name: "Explosion Test",
            width: tiles[0].length,
            height: tiles.length,
            tileSize,
            tiles
        }),
        game
    );
    Object.assign(game, { map });
    return map;
}

function createMockUnit(
    game: Game,
    itemManager: ItemManager,
    location: TilePos,
    withGrenade = false,
    options: { id?: string; withStun?: boolean } = {}
): Unit {
    const inventory = new Inventory({ inUse: null, items: [] }, itemManager);
    let grenade: Item | undefined;
    if (withGrenade) {
        grenade = itemManager.newItem("test.frag.grenade");
        inventory.addItem(grenade);
        inventory.selectItem(grenade);
    } else if (options.withStun) {
        grenade = itemManager.newItem("test.stun.grenade");
        inventory.addItem(grenade);
        inventory.selectItem(grenade);
    }

    let disorientation = 0;
    let constitution = 100;
    const flesh = MaterialManager.GetSingleton().getMaterial("flesh.material");

    const unit = {
        id: options.id ?? "unit-1",
        type: UNIT_TYPE,
        location,
        mapLocation: location,
        inventory,
        side: { id: "side-1", oppositionSideIds: [] as string[] },
        itemInUse: grenade ?? null,
        isAlive: true,
        materials: [flesh],
        get disorientation() {
            return disorientation;
        },
        set disorientation(value: number) {
            disorientation = Math.max(0, value);
        },
        get constitution() {
            return constitution;
        },
        getRenderList() {
            return [{ imageId: "unit-body" }];
        },
        getHitSparkColour() {
            return { r: 255, g: 0, b: 0, a: 1 };
        },
        inflictDamage(_worldPos: Vec2, projectile: Projectile): boolean {
            const { type, amount } = projectile.calcDamage(UNIT_TYPE);
            if (type === "disorientation") {
                disorientation += amount;
                return false;
            }
            const previous = constitution;
            constitution = Math.max(0, constitution - amount);
            return previous > 0 && constitution === 0;
        }
    } as unknown as Unit;

    (
        game as unknown as { sides: { id: string; units: Unit[]; oppositionSideIds: string[] }[] }
    ).sides = [{ id: "side-1", units: [unit], oppositionSideIds: [] }];

    return unit;
}

function shockwaveAnimations(result: ExplosionDetonationResult) {
    return result.animations.filter((animation) => animation.playAnimation.worldPos);
}

function disorientationOrbitAnimations(result: ExplosionDetonationResult) {
    return result.animations.filter((animation) =>
        animation.playAnimation.instanceId.startsWith("anim-disorient-")
    );
}

function tracerDirectionFromOrigin(
    tracer: ExplosionDetonationResult["tracers"][number],
    origin: Vec2
): number {
    const end = new Vec2(tracer.segments[tracer.segments.length - 1].pos);
    const fromOrigin = end.sub(origin);
    return Math.atan2(fromOrigin.y, fromOrigin.x);
}

describe("ExplosionSystem fragment spray", () => {
    const gameId = "EXPLOSION-RADIAL-TEST";
    let tileSize: number;
    let tempDir: string;
    let imageManager: ImageManager;
    let game: Game;
    let itemManager: ItemManager;

    beforeEach(() => {
        ({ tileSize, tempDir, imageManager, game, itemManager } = setupExplosionFixture(gameId));
    });

    afterEach(() => {
        teardownExplosionFixture(tempDir, imageManager);
    });

    it("spawns the configured fragment count with roughly even angular coverage", () => {
        const map = createMap(game, tileSize, [
            [openTile(), openTile(), openTile()],
            [openTile(), openTile(), openTile()],
            [openTile(), openTile(), openTile()]
        ]);
        const unit = createMockUnit(game, itemManager, new TilePos(1, 1));
        const weapon = itemManager.newItem("test.frag.grenade");
        const origin = map.tileCenterToWorld(new TilePos(1, 1));
        const explosion = testFragmentExplosion({ numFragments: 8, angleJitter: 0 });

        const result = detonateExplosion({
            game,
            origin,
            explosion,
            firingUnit: unit,
            firingWeapon: weapon
        });

        expect(result.tracers).toHaveLength(8);

        const angles = result.tracers
            .map((tracer) => tracerDirectionFromOrigin(tracer, origin))
            .sort((a, b) => a - b);

        // With angleJitter 0, adjacent fragments should be ~45° apart.
        const step = (Math.PI * 2) / 8;
        for (let i = 1; i < angles.length; i++) {
            const delta = angles[i] - angles[i - 1];
            expect(delta).toBeCloseTo(step, 1);
        }

        // Cover a full circle (first→last wrap).
        const wrap = angles[0] + Math.PI * 2 - angles[angles.length - 1];
        expect(wrap).toBeCloseTo(step, 1);
    });

    it("offsets fragment tracer times by the delivery impact time", () => {
        createMap(game, tileSize, [[openTile(), openTile(), openTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0));
        const weapon = itemManager.newItem("test.frag.grenade");
        const origin = new Vec2(50, 50);
        const timeOffsetMs = 250;

        const result = detonateExplosion({
            game,
            origin,
            explosion: testFragmentExplosion({ numFragments: 4 }),
            firingUnit: unit,
            firingWeapon: weapon,
            timeOffsetMs
        });

        for (const tracer of result.tracers) {
            expect(tracer.segments[0].time).toBeGreaterThanOrEqual(timeOffsetMs);
        }
    });

    it("omits fragment tracers when showFragmentExplosionTracers is false", () => {
        const map = createMap(game, tileSize, [[openTile(), wallTile(), openTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0));
        const weapon = itemManager.newItem("test.frag.grenade");
        const origin = map.tileCenterToWorld(new TilePos(0, 0));
        const previous = config.showFragmentExplosionTracers;

        try {
            config.showFragmentExplosionTracers = false;

            const result = detonateExplosion({
                game,
                origin,
                explosion: testFragmentExplosion({ numFragments: 4, angleJitter: 0 }),
                firingUnit: unit,
                firingWeapon: weapon
            });

            expect(result.tracers).toHaveLength(0);
            expect(result.hitSparks.length).toBeGreaterThan(0);
        } finally {
            config.showFragmentExplosionTracers = previous;
        }
    });
});

describe("HE impact explosion", () => {
    const gameId = "EXPLOSION-HE-TEST";
    let tileSize: number;
    let tempDir: string;
    let imageManager: ImageManager;
    let game: Game;
    let damageCache: DamageCacheManager;
    let itemManager: ItemManager;

    beforeEach(() => {
        ({ tileSize, tempDir, imageManager, game, damageCache, itemManager } =
            setupExplosionFixture(gameId));
    });

    afterEach(() => {
        teardownExplosionFixture(tempDir, imageManager);
    });

    it("force-stops an exploding round on the first solid hit and blooms fragments there", () => {
        const map = createMap(game, tileSize, [[openTile(), openTile(), wallTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0));
        const heRound = itemManager.newItem("test.he.round");
        const srcPos = map.tileCenterToWorld(new TilePos(0, 0));

        const projectile = new Projectile({
            game,
            firingUnit: unit,
            firingWeapon: heRound,
            projectileIndex: 0,
            roundIndex: 0,
            srcPos,
            directionVector: new Vec2(1, 0),
            projectileRecipe: heRound.projectileRecipe
        });

        expect(projectile.bounce).toBe(0);
        expect(projectile.projectileRecipe.explosion?.type).toBe("fragment");

        Projectile.ProcessProjectiles([projectile], map, undefined, damageCache);

        expect(projectile.impact).toBeDefined();
        expect(projectile.life).toBe(0);

        const impactTile = map.worldToTile(projectile.impact!.pos);
        expect(impactTile).toEqual(new TilePos(2, 0));

        const explosion = projectile.projectileRecipe.explosion!;
        const result = detonateExplosion({
            game,
            origin: projectile.impact!.pos.clone(),
            explosion,
            firingUnit: unit,
            firingWeapon: heRound,
            timeOffsetMs: projectile.impact!.time
        });

        expect(result.tracers.length).toBe(6);
        expect(result.tracers[0].segments[0].time).toBeGreaterThanOrEqual(projectile.impact!.time);
    });

    it("uses end-of-flight as the detonation point when no solid is hit (M203 open ground)", () => {
        const map = createMap(game, tileSize, [[openTile(), openTile(), openTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0));
        const heRound = itemManager.newItem("test.he.round");
        const srcPos = map.tileCenterToWorld(new TilePos(0, 0));
        const aimPos = map.tileCenterToWorld(new TilePos(2, 0));
        const travelDistance = aimPos.sub(srcPos).length;

        const projectile = new Projectile({
            game,
            firingUnit: unit,
            firingWeapon: heRound,
            projectileIndex: 0,
            roundIndex: 0,
            srcPos,
            directionVector: new Vec2(1, 0),
            projectileRecipe: {
                ...heRound.projectileRecipe,
                maxRange: travelDistance
            }
        });

        Projectile.ProcessProjectiles([projectile], map, undefined, damageCache);

        // No wall/unit collision — same as aiming an M203 at open ground.
        expect(projectile.impact).toBeUndefined();

        const { pos, time } = projectile.finalPostionAndTime;
        expect(map.worldToTile(pos)).toEqual(new TilePos(2, 0));
        expect(time).toBeGreaterThan(0);

        const explosion = projectile.projectileRecipe.explosion!;
        const result = detonateExplosion({
            game,
            origin: pos.clone(),
            explosion,
            firingUnit: unit,
            firingWeapon: heRound,
            timeOffsetMs: time
        });

        expect(result.tracers.length).toBe(6);
        expect(result.tracers[0].segments[0].time).toBeGreaterThanOrEqual(time);
    });
});

describe("primed grenade detonation", () => {
    const gameId = "EXPLOSION-PRIME-TEST";
    let tileSize: number;
    let tempDir: string;
    let imageManager: ImageManager;
    let game: Game;
    let itemManager: ItemManager;
    let sentMessages: unknown[];

    beforeEach(() => {
        ({ tileSize, tempDir, imageManager, game, itemManager, sentMessages } =
            setupExplosionFixture(gameId));
    });

    afterEach(() => {
        teardownExplosionFixture(tempDir, imageManager);
    });

    it("immediate throw path detonates at landing and consumes the item", () => {
        const map = createMap(game, tileSize, [[openTile(), openTile(), openTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0), true);
        const grenade = unit.inventory.itemInUse!;
        grenade.primed = "immediate";
        game.primeManager.registerPrimedItem(grenade, unit);

        const landingTilePos = new TilePos(2, 0);
        const landingTime = 180;

        unit.inventory.removeItem(grenade);
        const explosion = grenade.getExplosion;

        const { tileUpdates: consumeUpdates } = consumeExplodedItem(
            game,
            grenade,
            unit,
            landingTime
        );

        const result = detonateExplosion({
            game,
            origin: map.tileCenterToWorld(landingTilePos),
            explosion,
            firingUnit: unit,
            firingWeapon: grenade,
            timeOffsetMs: landingTime
        });

        expect(unit.inventory.findItem(grenade.id)).toBeUndefined();
        expect(game.itemManager.hasItem(grenade.id)).toBe(false);
        expect(game.primeManager.getPrimedBy(grenade)).toBeUndefined();
        expect(result.tracers.length).toBeGreaterThan(0);
        expect(result.tracers[0].segments[0].time).toBeGreaterThanOrEqual(landingTime);
        expect(consumeUpdates.length).toBe(0); // already removed from inventory before consume
        expect(map.getTile(landingTilePos).items).toHaveLength(0);
    });

    it("end-turn immediate fuse detonates a held grenade and consumes it", () => {
        const map = createMap(game, tileSize, [[openTile(), openTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0), true);
        const grenade = unit.inventory.itemInUse!;
        grenade.primed = "immediate";
        game.primeManager.registerPrimedItem(grenade, unit);

        game.primeManager.triggerEndTurn();

        expect(unit.inventory.findItem(grenade.id)).toBeUndefined();
        expect(game.itemManager.hasItem(grenade.id)).toBe(false);

        const fireTrace = sentMessages.find(
            (message) =>
                typeof message === "object" &&
                message !== null &&
                "type" in message &&
                (message as { type: string }).type === "server:fire:trace"
        ) as { type: string; payload: { tracers: unknown[]; isOnTarget: OnTarget } } | undefined;

        expect(fireTrace).toBeDefined();
        expect(fireTrace!.payload.tracers.length).toBeGreaterThan(0);
        expect(fireTrace!.payload.isOnTarget).toBe(OnTarget.enum.none);
        expect(map.getTile(unit.mapLocation).items).toHaveLength(0);
    });

    it("end-turn expired numeric fuse detonates a ground grenade", () => {
        const map = createMap(game, tileSize, [[openTile(), openTile(), openTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0));
        const grenade = itemManager.newItem("test.frag.grenade");
        grenade.primed = 0;
        grenade.location = new TilePos(2, 0);
        map.getTile(grenade.location).addItem(grenade);
        game.primeManager.registerPrimedItem(grenade, unit);

        game.primeManager.triggerEndTurn();

        expect(map.getTile(new TilePos(2, 0)).items).toHaveLength(0);
        expect(game.itemManager.hasItem(grenade.id)).toBe(false);

        const fireTrace = sentMessages.find(
            (message) =>
                typeof message === "object" &&
                message !== null &&
                "type" in message &&
                (message as { type: string }).type === "server:fire:trace"
        ) as { type: string; payload: { tracers: unknown[] } } | undefined;

        expect(fireTrace).toBeDefined();
        expect(fireTrace!.payload.tracers.length).toBeGreaterThan(0);
    });

    it("end-turn decrements numeric fuse without detonating when still positive", () => {
        createMap(game, tileSize, [[openTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0), true);
        const grenade = unit.inventory.itemInUse!;
        grenade.primed = 2;
        game.primeManager.registerPrimedItem(grenade, unit);

        game.primeManager.triggerEndTurn();

        expect(grenade.primed).toBe(1);
        expect(unit.inventory.findItem(grenade.id)).toBe(grenade);
        expect(sentMessages).toHaveLength(0);
    });
});

describe("ExplosionSystem shockwave", () => {
    const gameId = "EXPLOSION-SHOCKWAVE-TEST";
    let tileSize: number;
    let tempDir: string;
    let imageManager: ImageManager;
    let game: Game;
    let itemManager: ItemManager;
    let damageCache: DamageCacheManager;
    let previousShowShockwaveTracers: boolean;

    beforeEach(() => {
        ({ tileSize, tempDir, imageManager, game, itemManager, damageCache } =
            setupExplosionFixture(gameId));
        previousShowShockwaveTracers = config.showShockwaveExplosionTracers;
        config.showShockwaveExplosionTracers = false;
    });

    afterEach(() => {
        config.showShockwaveExplosionTracers = previousShowShockwaveTracers;
        teardownExplosionFixture(tempDir, imageManager);
    });

    it("applies disorientation to a unit in LOS and not to a unit behind a wall", () => {
        // open | open | wall | open — origin in tile0, exposed in tile1, sheltered in tile3
        const map = createMap(game, tileSize, [[openTile(), openTile(), wallTile(), openTile()]]);
        const firer = createMockUnit(game, itemManager, new TilePos(0, 0));
        const exposed = createMockUnit(game, itemManager, new TilePos(1, 0), false, {
            id: "exposed"
        });
        const sheltered = createMockUnit(game, itemManager, new TilePos(3, 0), false, {
            id: "sheltered"
        });

        // ProcessProjectiles uses `instanceof Unit` — give mocks a real prototype.
        Object.setPrototypeOf(exposed, Unit.prototype);
        Object.setPrototypeOf(sheltered, Unit.prototype);

        map.getTile(exposed.mapLocation).addUnit(exposed);
        map.getTile(sheltered.mapLocation).addUnit(sheltered);

        (
            game as unknown as {
                sides: { id: string; units: Unit[]; oppositionSideIds: string[] }[];
            }
        ).sides = [{ id: "side-1", units: [firer, exposed, sheltered], oppositionSideIds: [] }];

        const weapon = itemManager.newItem("test.stun.grenade");
        const origin = map.tileCenterToWorld(new TilePos(0, 0));

        const result = detonateExplosion({
            game,
            origin,
            explosion: testShockwaveExplosion({
                maxRange: 400,
                numFragments: 24,
                angleJitter: 0
            }),
            firingUnit: firer,
            firingWeapon: weapon
        });

        expect(exposed.disorientation).toBeGreaterThan(0);
        expect(sheltered.disorientation).toBe(0);
        expect(result.tracers).toHaveLength(0);
        expect(shockwaveAnimations(result)).toHaveLength(1);
        expect(disorientationOrbitAnimations(result).length).toBeGreaterThan(0);
        expect(
            disorientationOrbitAnimations(result).every((animation) => animation.startTimeMs > 0)
        ).toBe(true);
        expect(result.hitSparks.length).toBeGreaterThan(0);
        expect(result.hitSparks.every((spark) => spark.kind === "disorientation")).toBe(true);
    });

    it("does not damage furniture hit points", () => {
        const map = createMap(game, tileSize, [[openTile(), wallTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0));
        const weapon = itemManager.newItem("test.stun.grenade");
        const wallTileRef = map.getTile(new TilePos(1, 0));
        const furniture = wallTileRef.furniture!;
        const hpBefore = furniture.hitPoints;

        const result = detonateExplosion({
            game,
            origin: map.tileCenterToWorld(new TilePos(0, 0)),
            explosion: testShockwaveExplosion({ maxRange: 200, numFragments: 12 }),
            firingUnit: unit,
            firingWeapon: weapon
        });

        expect(furniture.hitPoints).toBe(hpBefore);
        // Furniture impacts must not emit 💫 particles.
        expect(result.hitSparks).toHaveLength(0);
    });

    it("omits tracers, scales shockwave animation to maxRange, and emits 💫 on unit hits only", () => {
        const map = createMap(game, tileSize, [[openTile(), openTile(), wallTile()]]);
        const firer = createMockUnit(game, itemManager, new TilePos(0, 0));
        const target = createMockUnit(game, itemManager, new TilePos(1, 0), false, {
            id: "target"
        });
        Object.setPrototypeOf(target, Unit.prototype);
        map.getTile(target.mapLocation).addUnit(target);
        (
            game as unknown as {
                sides: { id: string; units: Unit[]; oppositionSideIds: string[] }[];
            }
        ).sides = [{ id: "side-1", units: [firer, target], oppositionSideIds: [] }];

        const weapon = itemManager.newItem("test.stun.grenade");
        const maxRange = 120;

        const result = detonateExplosion({
            game,
            origin: map.tileCenterToWorld(new TilePos(0, 0)),
            explosion: testShockwaveExplosion({ maxRange, numFragments: 16, angleJitter: 0 }),
            firingUnit: firer,
            firingWeapon: weapon
        });

        expect(result.tracers).toHaveLength(0);
        expect(shockwaveAnimations(result)).toHaveLength(1);

        const scale = shockwaveAnimations(result)[0].playAnimation.recipe.stateDef.scale;
        expect(Array.isArray(scale)).toBe(true);
        const [, sequence] = scale as [number, { toValue: number }[]];
        expect(sequence[0].toValue).toBe(maxRange * 2);

        expect(target.disorientation).toBeGreaterThan(0);
        expect(disorientationOrbitAnimations(result).length).toBeGreaterThan(0);
        expect(
            disorientationOrbitAnimations(result).every((animation) => animation.startTimeMs > 0)
        ).toBe(true);
        expect(result.hitSparks.length).toBeGreaterThan(0);
        for (const spark of result.hitSparks) {
            expect(spark.kind).toBe("disorientation");
            expect(spark.count).toBeLessThanOrEqual(8);
        }

        const scaleStep = sequence[0];
        expect(scaleStep.type).toBe("linear");
        // Travel time = maxRange / velocity * 1000 (velocity from test fixture visual = 500).
        expect(scaleStep.duration).toBeCloseTo((maxRange / 500) * 1000, 5);
    });

    it("force-stops a 40mm stun round on first solid hit and blooms a shockwave", () => {
        const map = createMap(game, tileSize, [[openTile(), openTile(), wallTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0));
        const stunRound = itemManager.newItem("test.stun.round");
        const srcPos = map.tileCenterToWorld(new TilePos(0, 0));

        const projectile = new Projectile({
            game,
            firingUnit: unit,
            firingWeapon: stunRound,
            projectileIndex: 0,
            roundIndex: 0,
            srcPos,
            directionVector: new Vec2(1, 0),
            projectileRecipe: stunRound.projectileRecipe
        });

        expect(projectile.bounce).toBe(0);
        expect(projectile.projectileRecipe.explosion?.type).toBe("shockwave");

        Projectile.ProcessProjectiles([projectile], map, undefined, damageCache);

        expect(projectile.impact).toBeDefined();
        expect(projectile.life).toBe(0);

        const explosion = projectile.projectileRecipe.explosion!;
        const result = detonateExplosion({
            game,
            origin: projectile.impact!.pos.clone(),
            explosion,
            firingUnit: unit,
            firingWeapon: stunRound,
            timeOffsetMs: projectile.impact!.time
        });

        expect(result.tracers).toHaveLength(0);
        expect(result.animations).toHaveLength(1);
        expect(result.animations[0].startTimeMs).toBe(projectile.impact!.time);
        expect(result.hitSparks.every((spark) => spark.kind === "disorientation")).toBe(true);
    });

    it("includes shockwave ray tracers when showShockwaveExplosionTracers is true", () => {
        createMap(game, tileSize, [[openTile(), openTile(), openTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0));
        const weapon = itemManager.newItem("test.stun.grenade");
        const previous = config.showShockwaveExplosionTracers;

        try {
            config.showShockwaveExplosionTracers = true;

            const result = detonateExplosion({
                game,
                origin: new Vec2(50, 50),
                explosion: testShockwaveExplosion({ numFragments: 8, angleJitter: 0 }),
                firingUnit: unit,
                firingWeapon: weapon
            });

            expect(result.tracers).toHaveLength(8);
        } finally {
            config.showShockwaveExplosionTracers = previous;
        }
    });

    it("immediate stun throw detonates shockwave and consumes the item", () => {
        const map = createMap(game, tileSize, [[openTile(), openTile(), openTile()]]);
        const unit = createMockUnit(game, itemManager, new TilePos(0, 0), false, {
            withStun: true
        });
        const grenade = unit.inventory.itemInUse!;
        grenade.primed = "immediate";
        game.primeManager.registerPrimedItem(grenade, unit);

        const landingTilePos = new TilePos(2, 0);
        const landingTime = 180;

        unit.inventory.removeItem(grenade);
        const explosion = grenade.getExplosion;

        consumeExplodedItem(game, grenade, unit, landingTime);

        const result = detonateExplosion({
            game,
            origin: map.tileCenterToWorld(landingTilePos),
            explosion,
            firingUnit: unit,
            firingWeapon: grenade,
            timeOffsetMs: landingTime
        });

        expect(unit.inventory.findItem(grenade.id)).toBeUndefined();
        expect(game.itemManager.hasItem(grenade.id)).toBe(false);
        expect(result.tracers).toHaveLength(0);
        expect(result.animations).toHaveLength(1);
        expect(result.animations[0].startTimeMs).toBe(landingTime);
        expect(map.getTile(landingTilePos).items).toHaveLength(0);
    });
});
