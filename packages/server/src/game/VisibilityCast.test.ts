import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { TilePos, Vec2, DebugGraphic, DebugGraphicType, Orientation } from "@atbs/maths";
import { PNG } from "pngjs";
import type { Game } from "./Game.js";
import { FurnitureRecipe } from "./Furniture.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { Image } from "./Image.js";
import { ImageManager } from "./ImageManager.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { Material, MaterialRecipe } from "./Material.js";
import { MaterialManager } from "./MaterialManager.js";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";
import { Tile, TileRecipe } from "./Tile.js";
import { VisibilityManager, isDirectionInViewCone } from "./VisibilityManager.js";
import type { VisibilityPoi } from "./VisibilityPoi.js";
import type { VisibilityViewer } from "./VisibilityViewer.js";
import { VisibilityRay, VISUAL_RAY_LIFE } from "./VisibilityRay.js";
import { WorldMap, MapRecipe, type VisualRayCastResult } from "./WorldMap.js";
import type { InterestMask, VisualType } from "@atbs/shared-data";
import type { IRayCast } from "./IRayCast.js";

const OPAQUE_RGB = { r: 107, g: 66, b: 0 };
const GLASS_RGB = { r: 180, g: 220, b: 255 };

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

function createFurnitureRecipe(id: string, imageId: string, materialId: string): FurnitureRecipe {
    return FurnitureRecipe.parse({
        id,
        name: id,
        description: [{ text: id }],
        renderable: {
            default: {
                default: [{ imageId }],
                destroyed: []
            },
            FIRE_MODE: {
                default: [{ imageId: `${imageId}-cl` }],
                destroyed: []
            }
        },
        materials: [materialId],
        hitPoints: { max: 50 },
        movementObstruction: {
            default: { default: 100 },
            destroyed: { default: 0 }
        }
    });
}

describe("Material.getDensityForType", () => {
    it("uses infrared density when present", () => {
        const material = new Material(
            MaterialRecipe.parse({
                id: "test.material",
                category: "furniture",
                rgb: OPAQUE_RGB,
                densityMap: { default: 3, eyeball: 100, infrared: 5 },
                hardness: 0.15,
                toughness: 0.25,
                roughness: 0.8,
                elasticity: 0.05,
                density: 0.08
            })
        );

        expect(material.getDensityForType("infrared")).toBe(5);
        expect(material.getDensityForType("eyeball")).toBe(100);
    });

    it("falls back to default when infrared is absent", () => {
        const material = new Material(
            MaterialRecipe.parse({
                id: "test.material",
                category: "furniture",
                rgb: OPAQUE_RGB,
                densityMap: { default: 7, eyeball: 100 },
                hardness: 0.15,
                toughness: 0.25,
                roughness: 0.8,
                elasticity: 0.05,
                density: 0.08
            })
        );

        expect(material.getDensityForType("infrared")).toBe(7);
    });
});

describe("VisibilityRay", () => {
    it("exposes a mutable life budget starting at VISUAL_RAY_LIFE", () => {
        const ray = new VisibilityRay(new Vec2(0, 0), new Vec2(10, 0), "eyeball");
        expect(ray.life).toBe(VISUAL_RAY_LIFE);
        expect(ray.visualType).toBe("eyeball");

        ray.life -= 40;
        expect(ray.life).toBe(60);
        expect(ray.isRayAlive).toBe(true);

        ray.life = 0;
        expect(ray.isRayAlive).toBe(false);
    });
});

describe("visual ray casting", () => {
    const tileSize = 100;
    const gameId = "VIS-TEST";
    let tempDir: string;
    let imageManager: ImageManager;
    let materialManager: MaterialManager;
    let furnitureRecipeManager: FurnitureRecipeManager;
    let game: Game;
    let furnitureManager: FurnitureManager;
    let itemManager: ItemManager;
    let visibilityManager: VisibilityManager;

    beforeEach(() => {
        tempDir = mkdtempSync(path.join(tmpdir(), "atbs-visual-ray-"));
        imageManager = ImageManager.GetSingleton();

        for (const [id, rgb] of [
            ["opaque-wall", OPAQUE_RGB],
            ["opaque-wall-cl", OPAQUE_RGB],
            ["glass-wall", GLASS_RGB],
            ["glass-wall-cl", GLASS_RGB],
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

        materialManager = new MaterialManager();
        materialManager.addMaterial(
            MaterialRecipe.parse({
                id: "opaque-wood.material",
                category: "furniture",
                rgb: OPAQUE_RGB,
                densityMap: { default: 3, eyeball: 100 },
                hardness: 0.15,
                toughness: 0.25,
                roughness: 0.8,
                elasticity: 0.05,
                density: 0.08
            })
        );
        materialManager.addMaterial(
            MaterialRecipe.parse({
                id: "glass.material",
                category: "furniture",
                rgb: GLASS_RGB,
                densityMap: { default: 1, eyeball: 1 },
                hardness: 0.1,
                toughness: 0.05,
                roughness: 0.1,
                elasticity: 0.0,
                density: 0.05
            })
        );

        furnitureRecipeManager = new FurnitureRecipeManager();
        furnitureRecipeManager.addRecipe(
            createFurnitureRecipe("opaque-wall.furniture", "opaque-wall", "opaque-wood.material")
        );
        furnitureRecipeManager.addRecipe(
            createFurnitureRecipe("glass-wall.furniture", "glass-wall", "glass.material")
        );

        furnitureManager = new FurnitureManager(furnitureRecipeManager, materialManager);
        itemManager = new ItemManager(new ItemRecipeManager());

        // Single mutable Game object so managers/map share the same reference.
        game = { id: gameId, furnitureManager, itemManager } as Game;
        visibilityManager = new VisibilityManager(game);
        Object.assign(game, { visibilityManager });
    });

    afterEach(() => {
        for (const id of [
            "opaque-wall",
            "opaque-wall-cl",
            "glass-wall",
            "glass-wall-cl",
            "grass"
        ]) {
            if (imageManager.exists(id)) {
                imageManager.removeImage(id);
            }
        }
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    function createTile(location: TilePos, furnitureId?: string): Tile {
        return new Tile(
            location,
            tileSize,
            TileRecipe.parse({
                terrain: { id: "grass" },
                ...(furnitureId ? { furniture: { id: furnitureId } } : {})
            }),
            furnitureManager,
            visibilityManager
        );
    }

    function createMap(tiles: TileRecipe[][]): WorldMap {
        const map = new WorldMap(
            MapRecipe.parse({
                id: "visual-test.map",
                name: "Visual Test",
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

    it("blocks a visual ray in one opaque eyeball:100 pixel", () => {
        const tile = createTile(new TilePos(0, 0), "opaque-wall.furniture");
        const ray = new VisibilityRay(new Vec2(0, 50), new Vec2(99, 50), "eyeball");

        const hit = tile.castVisualRay(ray, "eyeball", new Vec2(0, 50), new Vec2(99, 50));

        expect(hit).toBeDefined();
        expect(hit?.material?.id).toBe("opaque-wood.material");
        expect(ray.isRayAlive).toBe(false);
        expect(ray.life).toBeLessThanOrEqual(0);
    });

    it("lets a visual ray survive multiple low-density eyeball pixels", () => {
        const tile = createTile(new TilePos(0, 0), "glass-wall.furniture");
        // 20 pixels at eyeball:1 leaves most of VISUAL_RAY_LIFE intact.
        const ray = new VisibilityRay(new Vec2(0, 50), new Vec2(20, 50), "eyeball");

        const hit = tile.castVisualRay(ray, "eyeball", new Vec2(0, 50), new Vec2(20, 50));

        expect(hit).toBeUndefined();
        expect(ray.isRayAlive).toBe(true);
        expect(ray.life).toBeLessThan(VISUAL_RAY_LIFE);
        expect(ray.life).toBeGreaterThan(VISUAL_RAY_LIFE - 30);
    });

    it("skips the viewer tile and succeeds on entering the POI tile", () => {
        const map = createMap([
            [
                TileRecipe.parse({
                    terrain: { id: "grass" },
                    furniture: { id: "opaque-wall.furniture" }
                }),
                TileRecipe.parse({ terrain: { id: "grass" } }),
                TileRecipe.parse({
                    terrain: { id: "grass" },
                    furniture: { id: "opaque-wall.furniture" }
                })
            ]
        ]);

        const skipTilePos = new TilePos(0, 0);
        const targetTilePos = new TilePos(2, 0);
        const ray = new VisibilityRay(
            map.tileCenterToWorld(skipTilePos),
            map.tileCenterToWorld(targetTilePos),
            "eyeball"
        );

        const result = map.castVisualRay(ray, "eyeball", { skipTilePos, targetTilePos });

        expect(result.visible).toBe(true);
        if (result.visible) {
            expect(result.tile.location).toEqual(targetTilePos);
        }
        expect(ray.isRayAlive).toBe(true);
    });

    it("fails when an opaque tile between viewer and POI exhausts life", () => {
        const map = createMap([
            [
                TileRecipe.parse({ terrain: { id: "grass" } }),
                TileRecipe.parse({
                    terrain: { id: "grass" },
                    furniture: { id: "opaque-wall.furniture" }
                }),
                TileRecipe.parse({ terrain: { id: "grass" } })
            ]
        ]);

        const skipTilePos = new TilePos(0, 0);
        const targetTilePos = new TilePos(2, 0);
        const ray = new VisibilityRay(
            map.tileCenterToWorld(skipTilePos),
            map.tileCenterToWorld(targetTilePos),
            "eyeball"
        );

        const result = map.castVisualRay(ray, "eyeball", { skipTilePos, targetTilePos });

        expect(result.visible).toBe(false);
        expect(ray.isRayAlive).toBe(false);
        if (!result.visible) {
            expect(result.material?.id).toBe("opaque-wood.material");
            expect(result.tile?.location).toEqual(new TilePos(1, 0));
        }
    });
});

describe("VisibilityManager debugGraphics", () => {
    const tileSize = 100;

    function tileCenterToWorld(tilePos: TilePos): Vec2 {
        const half = tileSize / 2;
        return new Vec2(tilePos.col * tileSize + half, tilePos.row * tileSize + half);
    }

    function createMockPoi(location: TilePos): VisibilityPoi {
        return {
            interestMasks: ["items"] as InterestMask[],
            location,
            intersectsRay: () => undefined
        };
    }

    function createMockViewer(
        id: string,
        location: TilePos,
        pois: VisibilityPoi[],
        options: {
            orientation?: Orientation;
            viewAngleInDegrees?: number;
            isDirectional?: boolean;
        } = {}
    ): VisibilityViewer {
        let interestMasks: InterestMask[] = ["items"];
        let orientation = options.orientation ?? Orientation.NORTH;
        let viewerLocation: TilePos | null = location;

        return {
            id,
            visualType: "eyeball" as VisualType,
            viewAngleInDegrees: options.viewAngleInDegrees ?? 90,
            viewRange: 1000,
            isDirectional: options.isDirectional ?? true,
            isAlive: true,
            get interestMasks() {
                return interestMasks;
            },
            set interestMasks(value) {
                interestMasks = value;
            },
            get location() {
                return viewerLocation;
            },
            set location(value) {
                viewerLocation = value;
            },
            get orientation() {
                return orientation;
            },
            set orientation(value) {
                orientation = value;
            },
            get pois() {
                return pois;
            }
        };
    }

    let castVisualRay: ReturnType<typeof vi.fn>;
    let visibilityManager: VisibilityManager;

    beforeEach(() => {
        castVisualRay = vi.fn(
            (
                _ray: IRayCast,
                _visualType: VisualType,
                options: { skipTilePos: TilePos; targetTilePos: TilePos }
            ): VisualRayCastResult => ({
                visible: true,
                pos: tileCenterToWorld(options.targetTilePos),
                tile: { location: options.targetTilePos } as Tile
            })
        );

        const game = {
            id: "VIS-DEBUG",
            map: {
                tileSize,
                tileCenterToWorld,
                castVisualRay
            }
        } as unknown as Game;

        visibilityManager = new VisibilityManager(game);
    });

    it("populates lines for every viewer→POI ray, marking updated vs cached", () => {
        const poiA = createMockPoi(new TilePos(1, 0));
        const poiB = createMockPoi(new TilePos(2, 0));
        // Face east so both POIs are in a 90° view cone.
        const viewer = createMockViewer("viewer-1", new TilePos(0, 0), [poiA, poiB], {
            orientation: Orientation.EAST
        });
        visibilityManager.addViewer(viewer);

        const firstPass: DebugGraphic[] = [];
        visibilityManager.update(viewer.id, firstPass);

        expect(castVisualRay).toHaveBeenCalledTimes(2);
        const firstLines = firstPass.filter((g) => g.type === DebugGraphicType.enum.line);
        expect(firstLines).toHaveLength(2);
        expect(firstLines.every((line) => line.lineDash === undefined)).toBe(true);
        // In-cone → green-ish.
        expect(firstLines.every((line) => line.strokeColour.g > line.strokeColour.r)).toBe(true);

        const secondPass: DebugGraphic[] = [];
        visibilityManager.update(viewer.id, secondPass);

        // Cache hit — no further LOS casts.
        expect(castVisualRay).toHaveBeenCalledTimes(2);
        const secondLines = secondPass.filter((g) => g.type === DebugGraphicType.enum.line);
        expect(secondLines).toHaveLength(2);
        expect(secondLines.every((line) => line.lineDash !== undefined)).toBe(true);

        visibilityManager.invalidateViewerLocation(viewer.id);
        const thirdPass: DebugGraphic[] = [];
        visibilityManager.update(viewer.id, thirdPass);

        expect(castVisualRay).toHaveBeenCalledTimes(4);
        const thirdLines = thirdPass.filter((g) => g.type === DebugGraphicType.enum.line);
        expect(thirdLines).toHaveLength(2);
        expect(thirdLines.every((line) => line.lineDash === undefined)).toBe(true);
    });

    it("rechecks view-cone angles on orientation invalidate without recasting LOS", () => {
        const poiEast = createMockPoi(new TilePos(2, 0));
        const viewer = createMockViewer("viewer-2", new TilePos(0, 0), [poiEast], {
            orientation: Orientation.EAST,
            viewAngleInDegrees: 90
        });
        visibilityManager.addViewer(viewer);

        const firstPass: DebugGraphic[] = [];
        visibilityManager.update(viewer.id, firstPass);
        expect(castVisualRay).toHaveBeenCalledTimes(1);
        const firstLine = firstPass.filter((g) => g.type === DebugGraphicType.enum.line)[0];
        expect(firstLine.strokeColour.g).toBeGreaterThan(firstLine.strokeColour.r);

        viewer.orientation = Orientation.WEST;
        visibilityManager.invalidateViewerOrientation(viewer.id);

        const afterRotate: DebugGraphic[] = [];
        visibilityManager.update(viewer.id, afterRotate);
        expect(castVisualRay).toHaveBeenCalledTimes(1);
        const line = afterRotate.filter((g) => g.type === DebugGraphicType.enum.line)[0];
        // Out-of-cone → red-ish, and treated as updated (solid).
        expect(line.strokeColour.r).toBeGreaterThan(line.strokeColour.g);
        expect(line.lineDash).toBeUndefined();
    });
});

describe("isDirectionInViewCone", () => {
    it("treats same position and non-directional viewers as in-cone", () => {
        const origin = new Vec2(50, 50);
        expect(isDirectionInViewCone(origin, origin, Orientation.NORTH, 90, true)).toBe(true);
        expect(isDirectionInViewCone(origin, new Vec2(100, 50), Orientation.NORTH, 90, false)).toBe(
            true
        );
        expect(isDirectionInViewCone(origin, new Vec2(100, 50), Orientation.CENTER, 90, true)).toBe(
            true
        );
    });

    it("accepts targets within half the view angle of facing", () => {
        const origin = new Vec2(50, 50);
        // Facing north (0, -1): target further north is in cone.
        expect(isDirectionInViewCone(origin, new Vec2(50, 0), Orientation.NORTH, 90, true)).toBe(
            true
        );
        // Due east is 90° from north — outside a 90° cone (±45°).
        expect(isDirectionInViewCone(origin, new Vec2(100, 50), Orientation.NORTH, 90, true)).toBe(
            false
        );
        // Facing east: due east is in cone.
        expect(isDirectionInViewCone(origin, new Vec2(100, 50), Orientation.EAST, 90, true)).toBe(
            true
        );
    });
});
