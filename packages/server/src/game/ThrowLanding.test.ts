import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { TilePos, Vec2 } from "@atbs/maths";
import { PNG } from "pngjs";
import type { Game } from "./Game.js";
import { DamageCacheManager } from "./DamageCacheManager.js";
import { FurnitureRecipe } from "./Furniture.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { Image } from "./Image.js";
import { ImageManager } from "./ImageManager.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import type { Item } from "./Item.js";
import { MaterialManager } from "./MaterialManager.js";
import { MaterialRecipe } from "./Material.js";
import { Projectile, DEFAULT_PROJECTILE_TRAVEL_VELOCITY } from "./Projectile.js";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { TileRecipe } from "./Tile.js";
import type { Unit } from "./Unit.js";
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

function setupThrowLandingFixture(gameId: string) {
    const tileSize = 100;
    const tempDir = mkdtempSync(path.join(tmpdir(), "atbs-throw-landing-"));
    const imageManager = ImageManager.GetSingleton();
    const damageCache = new DamageCacheManager(gameId);

    for (const [id, rgb] of [
        ["wall", WALL_RGB],
        ["wall-cl", WALL_RGB],
        ["grass", { r: 0, g: 128, b: 0 }]
    ] as const) {
        if (!imageManager.exists(id)) {
            imageManager.addImage(id, tempDir, createSolidImage(id, tileSize, rgb));
        }
    }

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

    const furnitureRecipeManager = new FurnitureRecipeManager();
    furnitureRecipeManager.addRecipe(createWallRecipe());

    const furnitureManager = new FurnitureManager(furnitureRecipeManager, materialManager);
    const itemManager = new ItemManager(new ItemRecipeManager());

    const game = {
        id: gameId,
        furnitureManager,
        itemManager,
        damageCacheManager: damageCache
    } as Game;
    const visibilityManager = new VisibilityManager(game);
    Object.assign(game, { visibilityManager });

    return { tileSize, tempDir, imageManager, game, damageCache };
}

function teardownThrowLandingFixture(tempDir: string, imageManager: ImageManager) {
    for (const id of ["wall", "wall-cl", "grass"]) {
        if (imageManager.exists(id)) {
            imageManager.removeImage(id);
        }
    }
    if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
    }
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

/** Mirrors Unit.throw landing focus selection after ProcessProjectiles. */
function resolveThrowLandingLikeUnit(map: WorldMap, projectile: Projectile, fallback: TilePos) {
    const { pos: finalWorldPos } = projectile.finalPostionAndTime;
    const segments = projectile.segments;
    const lastSegPos = new Vec2(segments.at(-1)!.pos);
    const lastHitTile = map.sampleTile(map.worldToTile(lastSegPos));
    const dropInFrontOfHit = segments.length >= 2 && !!lastHitTile?.blocksMovement(UNIT_TYPE);

    const landingFocusWorldPos = dropInFrontOfHit ? lastSegPos : finalWorldPos;
    const approachFromWorldPos = dropInFrontOfHit
        ? new Vec2(segments.at(-2)!.pos)
        : segments.length >= 2 && lastSegPos.isEqual(finalWorldPos)
          ? new Vec2(segments.at(-2)!.pos)
          : lastSegPos;

    return map.resolveNonObstructedLandingTile(
        landingFocusWorldPos,
        approachFromWorldPos,
        UNIT_TYPE,
        fallback
    );
}

describe("WorldMap.resolveNonObstructedLandingTile", () => {
    const gameId = "THROW-LANDING-TEST";
    let tileSize: number;
    let tempDir: string;
    let imageManager: ImageManager;
    let game: Game;

    beforeEach(() => {
        ({ tileSize, tempDir, imageManager, game } = setupThrowLandingFixture(gameId));
    });

    afterEach(() => {
        teardownThrowLandingFixture(tempDir, imageManager);
    });

    function createMap(tiles: TileRecipe[][]): WorldMap {
        const map = new WorldMap(
            MapRecipe.parse({
                id: "throw-landing.map",
                name: "Throw Landing Test",
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

    it("returns the impact tile when it does not block movement", () => {
        const map = createMap([[openTile(), openTile(), openTile()]]);
        const fallback = new TilePos(0, 0);
        const finalWorldPos = map.tileCenterToWorld(new TilePos(2, 0));
        const approachFrom = map.tileCenterToWorld(new TilePos(0, 0));

        const landing = map.resolveNonObstructedLandingTile(
            finalWorldPos,
            approachFrom,
            UNIT_TYPE,
            fallback
        );

        expect(landing.location).toEqual(new TilePos(2, 0));
        expect(landing.blocksMovement(UNIT_TYPE)).toBe(false);
    });

    it("returns the previous clear tile when the impact tile blocks movement", () => {
        // Approach left → right into a wall on col 2.
        const map = createMap([[openTile(), openTile(), wallTile()]]);
        const fallback = new TilePos(0, 0);
        const finalWorldPos = map.tileCenterToWorld(new TilePos(2, 0));
        const approachFrom = map.tileCenterToWorld(new TilePos(0, 0));

        const landing = map.resolveNonObstructedLandingTile(
            finalWorldPos,
            approachFrom,
            UNIT_TYPE,
            fallback
        );

        expect(landing.location).toEqual(new TilePos(1, 0));
        expect(landing.blocksMovement(UNIT_TYPE)).toBe(false);
    });

    it("keeps the last clear tile along an all-clear path ending on an obstructed tile", () => {
        const map = createMap([[openTile(), openTile(), openTile(), wallTile()]]);
        const fallback = new TilePos(0, 0);
        const finalWorldPos = map.tileCenterToWorld(new TilePos(3, 0));
        const approachFrom = map.tileCenterToWorld(new TilePos(0, 0));

        const landing = map.resolveNonObstructedLandingTile(
            finalWorldPos,
            approachFrom,
            UNIT_TYPE,
            fallback
        );

        expect(landing.location).toEqual(new TilePos(2, 0));
    });

    it("falls back to the thrower tile when no clear approach tile is found", () => {
        // Entire path is outside the map → walkGridCells yields nothing.
        const map = createMap([[wallTile()]]);
        const fallback = new TilePos(0, 0);
        const finalWorldPos = new Vec2(-50, -50);
        const approachFrom = new Vec2(-150, -50);

        const landing = map.resolveNonObstructedLandingTile(
            finalWorldPos,
            approachFrom,
            UNIT_TYPE,
            fallback
        );

        expect(landing.location).toEqual(fallback);
    });

    it("still resolves the pre-impact clear tile when approachFrom equals final (post-commit stop)", () => {
        // Mirrors Unit.throw after ProcessProjectiles stops on a wall: the hit has
        // already been commitSegmentTo'd, so last segment pos === finalWorldPos.
        // Callers must pass the previous segment as approachFrom; this asserts the
        // helper then finds the adjacent clear tile (not the thrower fallback).
        const map = createMap([[openTile(), openTile(), wallTile()]]);
        const fallback = new TilePos(0, 0);
        const finalWorldPos = map.tileCenterToWorld(new TilePos(2, 0));
        const approachFrom = map.tileCenterToWorld(new TilePos(0, 0));

        // Zero-length approach (bug): only the wall cell → fallback.
        const buggy = map.resolveNonObstructedLandingTile(
            finalWorldPos,
            finalWorldPos,
            UNIT_TYPE,
            fallback
        );
        expect(buggy.location).toEqual(fallback);

        // Correct approach origin (previous segment): last clear before the wall.
        const landing = map.resolveNonObstructedLandingTile(
            finalWorldPos,
            approachFrom,
            UNIT_TYPE,
            fallback
        );
        expect(landing.location).toEqual(new TilePos(1, 0));
    });
});

describe("thrown projectile landing after wall impact", () => {
    const gameId = "THROW-IMPACT-LANDING-TEST";
    let tileSize: number;
    let tempDir: string;
    let imageManager: ImageManager;
    let game: Game;
    let damageCache: DamageCacheManager;

    beforeEach(() => {
        ({ tileSize, tempDir, imageManager, game, damageCache } = setupThrowLandingFixture(gameId));
    });

    afterEach(() => {
        teardownThrowLandingFixture(tempDir, imageManager);
    });

    it("lands in front of the wall after ricochet instead of falling back under the thrower", () => {
        // open | open | wall | open — a bounce reverses and flies off-map at full maxRange.
        const map = new WorldMap(
            MapRecipe.parse({
                id: "throw-impact.map",
                name: "Throw Impact",
                width: 4,
                height: 1,
                tileSize,
                tiles: [[openTile(), openTile(), wallTile(), openTile()]]
            }),
            game
        );
        Object.assign(game, { map });

        const throwerTile = new TilePos(0, 0);
        const srcPos = map.tileCenterToWorld(throwerTile);

        const projectile = new Projectile({
            game,
            firingUnit: { side: { id: "side-1" }, type: UNIT_TYPE } as Unit,
            firingWeapon: { weight: 1 } as Item,
            projectileIndex: 0,
            roundIndex: 0,
            srcPos,
            directionVector: new Vec2(1, 0),
            projectileRecipe: {
                numProjectiles: 1,
                maxRange: 350,
                perturbation: 0,
                visual: {
                    headColour: { r: 255, g: 255, b: 255, a: 1 },
                    headRadiusInPixels: 2,
                    trailColour: { r: 255, g: 255, b: 255, a: 1 },
                    trailLengthInPixels: 100,
                    rangeFalloffPower: 20
                },
                damage: { default: 0, type: "default" },
                mass: 0.4,
                velocity: DEFAULT_PROJECTILE_TRAVEL_VELOCITY,
                impactVelocity: 12,
                diameter: 40,
                hardness: 0,
                shape: 0,
                stability: 0.2,
                bounce: 1,
                delivery: "thrown",
                integrity: 0
            }
        });

        const hitSparks = Projectile.ProcessProjectiles([projectile], map, undefined, damageCache);

        expect(hitSparks.length).toBeGreaterThan(0);

        // Post-ricochet free-flight destination is off-map — must not drive landing.
        const { pos: finalWorldPos } = projectile.finalPostionAndTime;
        expect(map.sampleTile(map.worldToTile(finalWorldPos))).toBeUndefined();

        const landing = resolveThrowLandingLikeUnit(map, projectile, throwerTile);

        expect(landing.blocksMovement(UNIT_TYPE)).toBe(false);
        expect(landing.location).toEqual(new TilePos(1, 0));
        expect(landing.location).not.toEqual(throwerTile);
        expect(landing.location).not.toEqual(new TilePos(2, 0));
    });
});
