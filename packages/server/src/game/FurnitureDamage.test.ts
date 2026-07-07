import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Colour, Orientation, TilePos, Vec2 } from "@atbs/maths";
import { FurnitureState, RenderMode } from "@atbs/shared-data";
import { PNG } from "pngjs";
import { DamageCacheManager } from "./DamageCacheManager.js";
import { Furniture, FurnitureRecipe } from "./Furniture.js";
import { FurnitureDamageSystem } from "./FurnitureDamageSystem.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { Image } from "./Image.js";
import { ImageManager } from "./ImageManager.js";
import { Item } from "./Item.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { Material, MaterialRecipe } from "./Material.js";
import { MaterialManager } from "./MaterialManager.js";
import { Projectile } from "./Projectile.js";
import { Tile, TileRecipe } from "./Tile.js";
import { Terrain } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { TerrainRecipe } from "./Terrain.js";
import type { Game } from "./Game.js";

const THIN_WOOD_RGB = { r: 107, g: 66, b: 0 };

const ROUND_RECIPE = {
    id: "5.56mm-nato.round",
    type: "round" as const,
    name: "5.56mm NATO round",
    description: [{ text: "Test round" }],
    weight: 0.01231,
    renderable: { default: [{ imageId: "5.56mm-nato" }] },
    projectile: {
        maxRange: 3000,
        perturbation: 100,
        visual: {
            velocityInPps: 1000,
            headColour: { r: 255, g: 255, b: 255, a: 1 },
            headRadiusInPixels: 2,
            trailColour: { r: 255, g: 255, b: 255, a: 1 },
            trailLengthInPixels: 100,
            rangeFalloffPower: 20
        },
        damage: { human: 18, default: 20 },
        mass: 0.004,
        velocity: 993,
        diameter: 5.56,
        hardness: 1,
        shape: 1,
        stability: 1,
        bounce: 0.75,
        integrity: 1
    }
};

function createSolidImage(id: string, size: number, rgb = THIN_WOOD_RGB): Image {
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

function createWallRecipe(pixelDestruction: boolean): FurnitureRecipe {
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
        materials: ["thin-wood.material"],
        hitPoints: { max: 50 },
        pixelDestruction,
        movementObstruction: {
            default: { default: 100 },
            destroyed: { default: 0 }
        }
    });
}

function createDrinksMachineRecipe(): FurnitureRecipe {
    return FurnitureRecipe.parse({
        id: "drinks-machine.furniture",
        name: "Drinks Machine",
        description: [{ text: "Test drinks machine" }],
        renderable: {
            default: {
                default: [{ imageId: "drinks-machine" }],
                destroyed: []
            },
            FIRE_MODE: {
                default: [{ imageId: "drinks-machine-cl" }],
                destroyed: []
            }
        },
        materials: ["thin-wood.material"],
        hitPoints: { max: 50 },
        movementObstruction: {
            default: { default: 100 },
            destroyed: { default: 0 }
        }
    });
}

function createDoorRecipe(): FurnitureRecipe {
    return FurnitureRecipe.parse({
        id: "door.furniture",
        name: "Door",
        description: [{ text: "Test door" }],
        renderable: {
            default: {
                default: [{ imageId: "doorway" }, { imageId: "door" }],
                destroyed: [{ imageId: "doorway" }]
            },
            FIRE_MODE: {
                default: [{ imageId: "doorway-cl" }, { imageId: "door-cl" }],
                destroyed: [{ imageId: "doorway-cl" }]
            }
        },
        materials: ["thin-wood.material"],
        hitPoints: { max: 50 },
        pixelDestruction: true,
        movementObstruction: {
            default: { default: 100 },
            destroyed: { default: 0 }
        }
    });
}

function createMockMap(tileSize: number) {
    return {
        tileSize,
        worldToSubTile(tilePos: TilePos, worldPos: Vec2) {
            const tileTopLeft = tilePos.scale(tileSize);

            return new Vec2(worldPos).sub(tileTopLeft).clamp({
                min: { x: 0, y: 0 },
                max: { x: tileSize, y: tileSize }
            });
        }
    };
}

function createMockProjectile(
    round: Item,
    gameId: string,
    damageCache: DamageCacheManager,
    tileSize: number,
    index = 0
): Projectile {
    const mockGame = {
        id: gameId,
        damageCacheManager: damageCache,
        map: createMockMap(tileSize)
    } as Game;

    return new Projectile({
        game: mockGame,
        firingUnit: { side: { id: "side-1" } } as Projectile["firingUnit"],
        firingWeapon: round,
        index,
        srcPos: new Vec2(0, 50),
        directionVector: new Vec2(100, 0),
        projectileRecipe: round.projectileRecipe
    });
}

function createMockPixelProjectile(diameter = 5.56): Projectile {
    return {
        index: 0,
        diameter,
        furnitureDamage: 20,
        firingWeapon: {
            projectileRecipe: { diameter },
            calcDamage: () => 20
        } as Item
    } as Projectile;
}

function createUnitFireProjectile(
    round: Item,
    gun: Item,
    gameId: string,
    damageCache: DamageCacheManager,
    tileSize: number,
    index = 0
): Projectile {
    const mockGame = {
        id: gameId,
        damageCacheManager: damageCache,
        map: createMockMap(tileSize)
    } as Game;

    return new Projectile({
        game: mockGame,
        firingUnit: { side: { id: "side-1" } } as Projectile["firingUnit"],
        firingWeapon: gun,
        index,
        srcPos: new Vec2(0, 50),
        directionVector: new Vec2(100, 0),
        projectileRecipe: round.projectileRecipe
    });
}

describe("FurnitureDamageSystem", () => {
    const imageSize = 100;
    let tempDir: string;
    let imageManager: ImageManager;
    let materialManager: MaterialManager;
    let furnitureRecipeManager: FurnitureRecipeManager;
    let furnitureManager: FurnitureManager;
    let itemRecipeManager: ItemRecipeManager;
    let itemManager: ItemManager;
    let damageCache: DamageCacheManager;
    const gameId = "TEST-1234";
    const tilePos = new TilePos(2, 3);

    beforeEach(() => {
        tempDir = mkdtempSync(path.join(tmpdir(), "atbs-damage-test-"));
        imageManager = ImageManager.GetSingleton();

        for (const id of [
            "wall",
            "wall-cl",
            "door",
            "door-cl",
            "doorway",
            "doorway-cl",
            "drinks-machine",
            "drinks-machine-cl",
            "grass"
        ]) {
            if (!imageManager.exists(id)) {
                imageManager.addImage(id, tempDir, createSolidImage(id, imageSize));
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

        materialManager = new MaterialManager();
        materialManager.addMaterial(
            MaterialRecipe.parse({
                id: "thin-wood.material",
                category: "furniture",
                rgb: THIN_WOOD_RGB,
                densityMap: { default: 3 },
                hardness: 0.15,
                toughness: 0.25,
                roughness: 0.8,
                elasticity: 0.05,
                density: 0.08
            })
        );

        furnitureRecipeManager = new FurnitureRecipeManager();
        furnitureManager = new FurnitureManager(furnitureRecipeManager, materialManager);
        itemRecipeManager = new ItemRecipeManager();
        itemRecipeManager.addRecipe(ROUND_RECIPE);
        itemManager = new ItemManager(itemRecipeManager);
        damageCache = new DamageCacheManager(gameId);
    });

    afterEach(() => {
        for (const id of [
            `${gameId}-2-3-wall-cl`,
            `${gameId}-2-3-wall`,
            `${gameId}-2-3-door-cl`,
            `${gameId}-2-3-door`,
            `${gameId}-2-3-drinks-machine-cl`,
            `${gameId}-2-3-drinks-machine`
        ]) {
            if (imageManager.exists(id)) {
                imageManager.removeImage(id);
            }
        }

        if (existsSync(`./public/cache/damage/${gameId}`)) {
            rmSync(`./public/cache/damage/${gameId}`, { recursive: true, force: true });
        }
    });

    function createFurniture(recipe: FurnitureRecipe): Furniture {
        if (!furnitureRecipeManager.hasRecipe(recipe.id)) {
            furnitureRecipeManager.addRecipe(recipe);
        }
        return furnitureManager.newFurniture(recipe.id, { location: tilePos });
    }

    function createTile(furnitureRecipe: FurnitureRecipe): Tile {
        if (!furnitureRecipeManager.hasRecipe(furnitureRecipe.id)) {
            furnitureRecipeManager.addRecipe(furnitureRecipe);
        }

        return new Tile(
            tilePos,
            imageSize,
            TileRecipe.parse({
                terrain: { id: "grass" },
                furniture: { id: furnitureRecipe.id }
            }),
            furnitureManager
        );
    }

    it("applies HP damage once per material entry and destroys at zero", () => {
        const round = itemManager.newItem(ROUND_RECIPE.id, { quantity: 1 });
        const furniture = createFurniture(createWallRecipe(false));
        const tile = createTile(createWallRecipe(false));
        const damageSystem = new FurnitureDamageSystem(damageCache, imageSize);
        const dirtyTiles = new Set<TilePos>();

        const entryEvent = {
            pos: new Vec2(50, 50),
            tile,
            material: furniture.materials[0],
            owner: furniture,
            imageId: "wall-cl",
            layerIndex: 0
        };

        damageSystem.onMaterialEntry(
            createMockProjectile(round, gameId, damageCache, imageSize, 0),
            entryEvent,
            dirtyTiles
        );
        expect(furniture.hitPoints).toBe(30);
        expect(furniture.state).not.toBe(FurnitureState.enum.destroyed);

        damageSystem.onMaterialEntry(
            createMockProjectile(round, gameId, damageCache, imageSize, 1),
            entryEvent,
            dirtyTiles
        );
        expect(furniture.hitPoints).toBe(10);

        damageSystem.onMaterialEntry(
            createMockProjectile(round, gameId, damageCache, imageSize, 2),
            entryEvent,
            dirtyTiles
        );
        expect(furniture.hitPoints).toBe(0);
        expect(furniture.state).toBe(FurnitureState.enum.destroyed);
        expect(dirtyTiles.has(tilePos)).toBe(true);
    });

    it("does not duplicate HP damage on ricochet re-entry for the same projectile", () => {
        const round = itemManager.newItem(ROUND_RECIPE.id, { quantity: 1 });
        const furniture = createFurniture(createWallRecipe(false));
        const tile = createTile(createWallRecipe(false));
        const damageSystem = new FurnitureDamageSystem(damageCache, imageSize);
        const dirtyTiles = new Set<TilePos>();
        const projectile = createMockProjectile(round, gameId, damageCache, imageSize);

        const entryEvent = {
            pos: new Vec2(50, 50),
            tile,
            material: furniture.materials[0],
            owner: furniture,
            imageId: "wall-cl",
            layerIndex: 0
        };

        damageSystem.onMaterialEntry(projectile, entryEvent, dirtyTiles);
        damageSystem.onMaterialEntry(projectile, entryEvent, dirtyTiles);

        expect(furniture.hitPoints).toBe(30);
    });

    it("uses the fired round recipe when the weapon is a gun without a projectile recipe", () => {
        const round = itemManager.newItem(ROUND_RECIPE.id, { quantity: 1 });
        const gun = {
            id: "test-gun.gun",
            calcDamage: Item.prototype.calcDamage
        } as Item;
        const furniture = createFurniture(createWallRecipe(true));
        const tile = createTile(createWallRecipe(true));
        const damageSystem = new FurnitureDamageSystem(damageCache, imageSize);
        const dirtyTiles = new Set<TilePos>();
        const projectile = createUnitFireProjectile(
            round,
            gun,
            gameId,
            damageCache,
            imageSize
        );

        expect(() =>
            damageSystem.onMaterialEntry(
                projectile,
                {
                    pos: new Vec2(tilePos.col * imageSize + 50, tilePos.row * imageSize + 50),
                    tile,
                    material: furniture.materials[0],
                    owner: furniture,
                    imageId: "wall-cl",
                    layerIndex: 0,
                    orientation: Orientation.NORTH
                },
                dirtyTiles
            )
        ).not.toThrow();

        expect(furniture.hitPoints).toBe(30);
        expect(damageCache.hasTileCache(tilePos)).toBe(true);
    });

    it("clears pixels when material entry position is in world coordinates", () => {
        const round = itemManager.newItem(ROUND_RECIPE.id, { quantity: 1 });
        const furniture = createFurniture(createWallRecipe(true));
        const tile = createTile(createWallRecipe(true));
        const damageSystem = new FurnitureDamageSystem(damageCache, imageSize);
        const dirtyTiles = new Set<TilePos>();
        const projectile = createMockProjectile(round, gameId, damageCache, imageSize);
        const samplePos = { x: 50, y: 50 };
        const worldPos = new Vec2(
            tilePos.col * imageSize + samplePos.x,
            tilePos.row * imageSize + samplePos.y
        );

        damageSystem.onMaterialEntry(
            projectile,
            {
                pos: worldPos,
                tile,
                material: furniture.materials[0],
                owner: furniture,
                imageId: "wall-cl",
                layerIndex: 0,
                orientation: Orientation.NORTH
            },
            dirtyTiles
        );

        const damagedCollision = damageCache.getLayerImage("wall-cl", tilePos)!;
        expect(damagedCollision.getColour(samplePos, Orientation.NORTH).a).toBe(0);
    });

    it("continues clearing pixels when collision layers report damaged image ids", () => {
        const furniture = createFurniture(createWallRecipe(true));
        const damageSystem = new FurnitureDamageSystem(damageCache, imageSize);
        const dirtyTiles = new Set<TilePos>();
        const samplePos = { x: 50, y: 50 };
        const damagedId = `${gameId}-2-3-wall-cl`;

        damageSystem.onMaterialPixel(
            createMockPixelProjectile(),
            tilePos,
            new Vec2(samplePos.x, samplePos.y),
            {
                owner: furniture,
                imageId: damagedId,
                layerIndex: 0,
                material: furniture.materials[0],
                orientation: Orientation.NORTH
            },
            dirtyTiles
        );

        const damagedCollision = damageCache.getLayerImage("wall-cl", tilePos)!;
        expect(damagedCollision.getColour(samplePos, Orientation.NORTH).a).toBe(0);
    });

    it("applies HP but not pixel overrides for opt-out furniture", () => {
        const furniture = createFurniture(createDrinksMachineRecipe());

        expect(furniture.pixelDestruction).toBe(false);

        furniture.takeDamage(20);
        expect(furniture.hitPoints).toBe(30);

        const renderList = furniture.getRenderList(
            { renderMode: RenderMode.enum.FIRE_MODE, states: [] },
            damageCache
        );

        expect(renderList[0].imageId).toBe("drinks-machine-cl");
        expect(damageCache.hasTileCache(tilePos)).toBe(false);
    });

    it("creates and reuses a per-tile damage cache entry for pixel destruction", () => {
        const furniture = createFurniture(createWallRecipe(true));
        const damageSystem = new FurnitureDamageSystem(damageCache, imageSize);
        const dirtyTiles = new Set<TilePos>();

        damageSystem.onMaterialPixel(
            createMockPixelProjectile(),
            tilePos,
            { x: 50, y: 50 },
            {
                owner: furniture,
                imageId: "wall-cl",
                layerIndex: 0,
                material: furniture.materials[0],
                orientation: Orientation.NORTH
            },
            dirtyTiles
        );

        const damagedId = `${gameId}-2-3-wall-cl`;
        expect(imageManager.exists(damagedId)).toBe(true);
        expect(existsSync(`./public/cache/damage/${gameId}/${damagedId}.png`)).toBe(true);

        const renderList = furniture.getRenderList(
            { renderMode: RenderMode.enum.FIRE_MODE, states: [] },
            damageCache
        );
        expect(renderList[0].imageId).toBe(damagedId);

        damageSystem.onMaterialPixel(
            createMockPixelProjectile(),
            tilePos,
            { x: 55, y: 50 },
            {
                owner: furniture,
                imageId: "wall-cl",
                layerIndex: 0,
                material: furniture.materials[0],
                orientation: Orientation.NORTH
            },
            dirtyTiles
        );

        expect(renderList[0].imageId).toBe(damagedId);
        expect(dirtyTiles.has(tilePos)).toBe(true);
    });

    it("clears paired visual and collision pixels together for doors", () => {
        const furniture = createFurniture(createDoorRecipe());
        const damageSystem = new FurnitureDamageSystem(damageCache, imageSize);
        const dirtyTiles = new Set<TilePos>();
        const samplePos = { x: 50, y: 50 };

        expect(furniture.getPairedImageIds()).toEqual([
            { visualId: "doorway", collisionId: "doorway-cl", layerIndex: 0 },
            { visualId: "door", collisionId: "door-cl", layerIndex: 1 }
        ]);

        damageSystem.onMaterialPixel(
            createMockPixelProjectile(),
            tilePos,
            samplePos,
            {
                owner: furniture,
                imageId: "door-cl",
                layerIndex: 1,
                material: furniture.materials[0],
                orientation: Orientation.NORTH
            },
            dirtyTiles
        );

        const damagedCollision = damageCache.getLayerImage("door-cl", tilePos)!;
        const damagedVisual = damageCache.getLayerImage("door", tilePos)!;

        expect(damagedCollision.getColour(samplePos, Orientation.NORTH).a).toBe(0);
        expect(damagedVisual.getColour(samplePos, Orientation.NORTH).a).toBe(0);
    });

    it("cleans up cache files and ImageManager entries", () => {
        const furniture = createFurniture(createWallRecipe(true));
        const damageSystem = new FurnitureDamageSystem(damageCache, imageSize);
        const dirtyTiles = new Set<TilePos>();

        damageSystem.onMaterialPixel(
            createMockPixelProjectile(),
            tilePos,
            { x: 50, y: 50 },
            {
                owner: furniture,
                imageId: "wall-cl",
                layerIndex: 0,
                material: furniture.materials[0],
                orientation: Orientation.NORTH
            },
            dirtyTiles
        );

        const damagedId = `${gameId}-2-3-wall-cl`;
        expect(imageManager.exists(damagedId)).toBe(true);
        expect(existsSync(`./public/cache/damage/${gameId}/${damagedId}.png`)).toBe(true);

        damageCache.cleanup(imageManager);

        expect(imageManager.exists(damagedId)).toBe(false);
        expect(existsSync(`./public/cache/damage/${gameId}`)).toBe(false);
    });
});

describe("Image.clone", () => {
    it("creates an independent copy of image data", () => {
        const source = createSolidImage("clone-test", 4);
        const clone = source.clone("clone-test-copy");

        expect(clone.width).toBe(source.width);
        expect(clone.height).toBe(source.height);
        expect(clone.data).not.toBe(source.data);

        clone.setColour({ x: 0, y: 0 }, Orientation.NORTH, new Colour({ r: 0, g: 0, b: 0, a: 0 }));

        expect(source.getColour({ x: 0, y: 0 }, Orientation.NORTH).a).toBe(1);
        expect(clone.getColour({ x: 0, y: 0 }, Orientation.NORTH).a).toBe(0);
    });
});

describe("Tile.SampleCollisionLayers", () => {
    it("returns imageId and layerIndex for the hit layer", () => {
        const materialManager = new MaterialManager();
        materialManager.addMaterial(
            MaterialRecipe.parse({
                id: "thin-wood.material",
                category: "furniture",
                rgb: THIN_WOOD_RGB,
                densityMap: { default: 3 },
                hardness: 0.15,
                toughness: 0.25,
                roughness: 0.8,
                elasticity: 0.05,
                density: 0.08
            })
        );

        const furnitureRecipeManager = new FurnitureRecipeManager();
        furnitureRecipeManager.addRecipe(createDoorRecipe());
        const furnitureManager = new FurnitureManager(furnitureRecipeManager, materialManager);
        const tilePos = new TilePos(0, 0);

        const tempDir = mkdtempSync(path.join(tmpdir(), "atbs-tile-test-"));
        const imageManager = ImageManager.GetSingleton();
        for (const id of ["doorway-cl", "door-cl", "grass"]) {
            if (!imageManager.exists(id)) {
                imageManager.addImage(id, tempDir, createSolidImage(id, 100));
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

        const tile = new Tile(
            tilePos,
            100,
            TileRecipe.parse({
                terrain: { id: "grass" },
                furniture: { id: "door.furniture" }
            }),
            furnitureManager
        );

        const layers = tile.getCollisionLayers(imageManager);
        const sample = Tile.SampleCollisionLayers({ x: 50, y: 50 }, layers);

        expect(sample?.owner).toBe(tile.furniture);
        expect(sample?.imageId).toBe("doorway-cl");
        expect(sample?.layerIndex).toBe(0);
        expect(sample?.orientation).toBe(Orientation.NORTH);
        expect(sample?.material).toBeInstanceOf(Material);
    });
});
