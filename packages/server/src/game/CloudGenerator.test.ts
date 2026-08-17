import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { TilePos } from "@atbs/maths";
import * as Maths from "@atbs/maths";
import { AnimationRecipe, GasExplosion, RenderImage, RenderMode, SmokeExplosion } from "@atbs/shared-data";
import { PNG } from "pngjs";
import type { Game } from "./Game.js";
import { AnimationRecipeManager } from "./AnimationRecipeManager.js";
import { CloudGenerator, CLOUD_PARTICLE_STAGGER_MS } from "./CloudGenerator.js";
import { CloudManager } from "./CloudManager.js";
import { FurnitureRecipe } from "./Furniture.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { Image } from "./Image.js";
import { ImageManager } from "./ImageManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { MaterialRecipe } from "./Material.js";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { TileRecipe } from "./Tile.js";
import { VisibilityManager } from "./VisibilityManager.js";
import { VfxManager } from "./VfxManager.js";
import { VfxRecipeManager } from "./VfxRecipeManager.js";
import { appearTranslation } from "./Vfx.js";
import { WorldMap, MapRecipe } from "./WorldMap.js";
import { detonateExplosion } from "./ExplosionSystem.js";
import type { Unit } from "./Unit.js";

const WALL_RGB = { r: 107, g: 66, b: 0 };

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

function ensureAnimation(id: string, imageId: string, loop = false): void {
    const manager = AnimationRecipeManager.GetSingleton();
    if (manager.hasRecipe(id)) {
        return;
    }
    manager.addRecipe(
        AnimationRecipe.parse({
            id,
            ...(loop ? { flags: { loop: true } } : {}),
            stateDef: {
                scale: 100,
                opacity: 1,
                renderable: { default: [{ imageId }] }
            }
        })
    );
}

function openTile(): TileRecipe {
    return TileRecipe.parse({ terrain: { id: "grass" } });
}

function grateTile(): TileRecipe {
    return TileRecipe.parse({
        terrain: { id: "grass" },
        furniture: { id: "grate.furniture", orientation: 0 }
    });
}

function wallTile(): TileRecipe {
    return TileRecipe.parse({
        terrain: { id: "grass" },
        furniture: { id: "wall.furniture", orientation: 0 }
    });
}

describe("appearTranslation", () => {
    it("starts at the left edge when spreading from the west", () => {
        expect(appearTranslation({ col: 0, row: 1 }, { col: 1, row: 1 })).toEqual({
            from: { x: 0, y: 50 },
            to: { x: 50, y: 50 }
        });
    });

    it("stays at the tile centre for the origin puff", () => {
        expect(appearTranslation({ col: 2, row: 2 }, { col: 2, row: 2 })).toEqual({
            from: { x: 50, y: 50 },
            to: { x: 50, y: 50 }
        });
    });
});

describe("CloudGenerator", () => {
    const gameId = "CLOUD-GEN-TEST";
    let tileSize: number;
    let tempDir: string;
    let imageManager: ImageManager;
    let game: Game;
    let addedAnimationIds: string[];
    let addedVfxIds: string[];
    let addedMaterialIds: string[];

    beforeEach(() => {
        tileSize = 100;
        tempDir = mkdtempSync(path.join(tmpdir(), "atbs-cloud-"));
        imageManager = ImageManager.GetSingleton();
        addedAnimationIds = [];
        addedVfxIds = [];
        addedMaterialIds = [];

        for (const [id, rgb] of [
            ["wall", WALL_RGB],
            ["wall-cl", WALL_RGB],
            ["grass", { r: 0, g: 128, b: 0 }],
            ["smoke15", { r: 40, g: 40, b: 40 }]
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

        const materials = MaterialManager.GetSingleton();
        if (!materials.hasMaterial("smoke.material")) {
            materials.addMaterial(
                MaterialRecipe.parse({
                    id: "smoke.material",
                    category: "smoke",
                    rgb: { r: 0, g: 0, b: 0 },
                    densityMap: { default: 0.1, eyeball: 0.6 },
                    hardness: 0,
                    toughness: 0,
                    roughness: 0,
                    elasticity: 0,
                    density: 0.01
                })
            );
            addedMaterialIds.push("smoke.material");
        }
        if (!materials.hasMaterial("wood.material")) {
            materials.addMaterial(
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
            addedMaterialIds.push("wood.material");
        }

        for (const [id, imageId, loop] of [
            ["smoke-appear.animation", "smoke15", false],
            ["smoke-maintain.animation", "smoke15", true],
            ["smoke-disappear.animation", "smoke15", false]
        ] as const) {
            if (!AnimationRecipeManager.GetSingleton().hasRecipe(id)) {
                ensureAnimation(id, imageId, loop);
                addedAnimationIds.push(id);
            }
        }

        const vfxRecipes = VfxRecipeManager.GetSingleton();
        if (!vfxRecipes.hasRecipe("smoke.vfx")) {
            vfxRecipes.addRecipe({
                id: "smoke.vfx",
                animationRecipeIds: ["smoke-appear.animation", "smoke-maintain.animation"],
                disappearAnimationId: "smoke-disappear.animation",
                collisionImageId: "smoke15"
            });
            addedVfxIds.push("smoke.vfx");
        }

        const furnitureRecipeManager = new FurnitureRecipeManager();
        furnitureRecipeManager.addRecipe(
            FurnitureRecipe.parse({
                id: "grate.furniture",
                name: "Grate",
                description: [{ text: "Grate" }],
                renderable: {
                    default: { default: [{ imageId: "wall" }], destroyed: [] },
                    FIRE_MODE: { default: [{ imageId: "wall-cl" }], destroyed: [] }
                },
                materials: ["wood.material"],
                hitPoints: { max: 50 },
                movementObstruction: {
                    default: { default: 80 },
                    destroyed: { default: 0 }
                }
            })
        );
        furnitureRecipeManager.addRecipe(
            FurnitureRecipe.parse({
                id: "wall.furniture",
                name: "Wall",
                description: [{ text: "Wall" }],
                renderable: {
                    default: { default: [{ imageId: "wall" }], destroyed: [] },
                    FIRE_MODE: { default: [{ imageId: "wall-cl" }], destroyed: [] }
                },
                materials: ["wood.material"],
                hitPoints: { max: 50 },
                movementObstruction: {
                    default: { default: 100 },
                    destroyed: { default: 0 }
                }
            })
        );
        const furnitureManager = new FurnitureManager(
            furnitureRecipeManager,
            MaterialManager.GetSingleton()
        );

        const gameStub = {
            id: gameId,
            furnitureManager,
            sides: [] as { id: string; units: Unit[]; oppositionSideIds: string[] }[],
            messageRouter: { send: () => undefined },
            syncUnitsCanSee: () => undefined
        } as unknown as Game;

        const visibilityManager = new VisibilityManager(gameStub);
        const vfxRecipeManager = VfxRecipeManager.GetSingleton();
        Object.assign(gameStub, {
            visibilityManager,
            vfxRecipeManager,
            vfxManager: new VfxManager(gameStub),
            cloudManager: new CloudManager()
        });
        game = gameStub;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        for (const id of addedAnimationIds) {
            AnimationRecipeManager.GetSingleton().removeRecipe(id);
        }
        for (const id of addedVfxIds) {
            VfxRecipeManager.GetSingleton().removeRecipe(id);
        }
        for (const id of addedMaterialIds) {
            MaterialManager.GetSingleton().removeMaterial(id);
        }
        if (imageManager) {
            for (const id of ["wall", "wall-cl", "grass", "smoke15"]) {
                if (imageManager.exists(id)) {
                    imageManager.removeImage(id);
                }
            }
        }
        if (tempDir && existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    function createMap(tiles: TileRecipe[][]): WorldMap {
        const map = new WorldMap(
            MapRecipe.parse({
                id: "cloud.map",
                name: "Cloud Test",
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

    function smokeExplosion(particles: number[] = [3, 2]): SmokeExplosion {
        return SmokeExplosion.parse({
            type: "smoke",
            particles,
            lifetime: 2,
            vfxId: "smoke.vfx",
            materials: ["smoke.material"]
        });
    }

    it("spawns the first wave at the origin and spreads to open neighbours", () => {
        const map = createMap([
            [openTile(), openTile(), openTile()],
            [openTile(), openTile(), openTile()],
            [openTile(), openTile(), openTile()]
        ]);

        const origin = map.tileCenterToWorld(new TilePos(1, 1));
        const generator = new CloudGenerator({
            game,
            worldPos: origin,
            explosion: smokeExplosion([5])
        });
        const result = generator.tick();

        expect(result.animObjects).toHaveLength(5);
        expect(map.getTile(new TilePos(1, 1)).vfx).toHaveLength(1);
        expect(result.tileUpdates[0].timeMs).toBe(0);
        expect(result.tileUpdates[1].timeMs).toBe(CLOUD_PARTICLE_STAGGER_MS);
    });

    it("keeps the same puff rotation from appear through maintain and disappear", () => {
        const map = createMap([[openTile()]]);
        const origin = map.tileCenterToWorld(new TilePos(0, 0));
        const generator = new CloudGenerator({
            game,
            worldPos: origin,
            explosion: smokeExplosion([1])
        });
        const result = generator.tick();

        const recipes = result.animObjects![0].recipe.recipes;
        expect(recipes.length).toBeGreaterThanOrEqual(2);
        expect(typeof recipes[0].stateDef.rotation).toBe("number");
        expect(recipes[0].stateDef.rotation).toBe(recipes[1].stateDef.rotation);

        const vfx = map.getTile(new TilePos(0, 0)).vfx[0];
        const disappear = vfx.buildDisappearPlayAnimation(origin);
        expect(disappear?.recipe.stateDef.rotation).toBe(recipes[0].stateDef.rotation);
    });

    it("marks cloud VFX so the client only draws them on visible tiles", () => {
        const map = createMap([[openTile()]]);
        const origin = map.tileCenterToWorld(new TilePos(0, 0));
        const result = new CloudGenerator({
            game,
            worldPos: origin,
            explosion: smokeExplosion([1])
        }).tick();

        const mapMode: RenderImage[] =
            result.tileUpdates[0].tileByRenderMode[RenderMode.enum.MAP_MODE];
        const vfxImages = mapMode.filter((image) => image.imageId.startsWith("anim-"));
        expect(vfxImages.length).toBeGreaterThan(0);
        expect(vfxImages.every((image) => image.visibilityFilter === true)).toBe(true);
    });

    it("does not enter a 100-obstruction wall and retries it next wave", () => {
        const map = createMap([
            [openTile(), wallTile(), openTile()],
            [openTile(), openTile(), openTile()]
        ]);

        const generator = new CloudGenerator({
            game,
            worldPos: map.tileCenterToWorld(new TilePos(0, 0)),
            explosion: smokeExplosion([1, 8])
        });

        generator.tick();
        expect(map.getTile(new TilePos(0, 0)).vfx).toHaveLength(1);
        expect(map.getTile(new TilePos(1, 0)).vfx).toHaveLength(0);

        generator.tick();
        expect(map.getTile(new TilePos(1, 0)).vfx).toHaveLength(0);
        expect(map.getTile(new TilePos(0, 1)).vfx.length).toBeGreaterThan(0);
    });

    it("retries a failed obstruction roll on the next wave", () => {
        const map = createMap([[openTile(), grateTile(), openTile()]]);
        const randomSpy = vi.spyOn(Maths, "generateRandomBetween");
        randomSpy.mockReturnValueOnce(0).mockReturnValue(0.99);

        const generator = new CloudGenerator({
            game,
            worldPos: map.tileCenterToWorld(new TilePos(0, 0)),
            explosion: smokeExplosion([2, 2])
        });

        const first = generator.tick();
        expect(first.animObjects).toHaveLength(1);
        expect(map.getTile(new TilePos(1, 0)).vfx).toHaveLength(0);

        randomSpy.mockReturnValue(0);
        const second = generator.tick();
        expect(second.animObjects!.length).toBeGreaterThan(0);
        expect(
            map.getTile(new TilePos(1, 0)).vfx.length + map.getTile(new TilePos(0, 0)).vfx.length
        ).toBeGreaterThan(1);
    });

    it("expires puffs after their lifetime and plays disappear animations", () => {
        const map = createMap([[openTile(), openTile()]]);
        const generator = new CloudGenerator({
            game,
            worldPos: map.tileCenterToWorld(new TilePos(0, 0)),
            explosion: smokeExplosion([1])
        });

        generator.tick();
        expect(map.getTile(new TilePos(0, 0)).vfx).toHaveLength(1);

        generator.tick();
        expect(map.getTile(new TilePos(0, 0)).vfx).toHaveLength(1);
        expect(generator.hasWorkRemaining).toBe(true);

        const expired = generator.tick();
        expect(map.getTile(new TilePos(0, 0)).vfx).toHaveLength(0);
        expect(expired.animObjectRemovals).toHaveLength(1);
        expect(expired.animations).toHaveLength(1);
        expect(generator.hasWorkRemaining).toBe(false);
    });

    it("stacks puffs from different generators on the same tile", () => {
        const map = createMap([[openTile()]]);
        const origin = map.tileCenterToWorld(new TilePos(0, 0));
        const explosion = smokeExplosion([1]);

        new CloudGenerator({ game, worldPos: origin, explosion }).tick();
        new CloudGenerator({ game, worldPos: origin, explosion }).tick();

        expect(map.getTile(new TilePos(0, 0)).vfx).toHaveLength(2);
    });

    it("detonateExplosion registers a generator on the firing side", () => {
        const map = createMap([[openTile(), openTile()]]);
        const firingUnit = { side: { id: "side-1" } } as Unit;

        const result = detonateExplosion({
            game,
            origin: map.tileCenterToWorld(new TilePos(0, 0)),
            explosion: smokeExplosion([1, 1]),
            firingUnit,
            firingWeapon: {} as never
        });

        expect(result.animObjects!.length).toBe(1);
        const later = game.cloudManager.tickSide("side-1");
        expect(later?.animObjects?.length).toBe(1);
    });

    it("scales gas damage as a full-turn dose across stacked puffs", () => {
        const map = createMap([[openTile()]]);
        const explosion = GasExplosion.parse({
            type: "gas",
            particles: [1],
            lifetime: 3,
            vfxId: "smoke.vfx",
            materials: ["smoke.material"],
            damage: { default: 10 }
        });

        new CloudGenerator({
            game,
            worldPos: map.tileCenterToWorld(new TilePos(0, 0)),
            explosion
        }).tick();
        new CloudGenerator({
            game,
            worldPos: map.tileCenterToWorld(new TilePos(0, 0)),
            explosion
        }).tick();

        expect(map.getTile(new TilePos(0, 0)).getVfxHpDamage("human")).toBe(20);
    });
});
