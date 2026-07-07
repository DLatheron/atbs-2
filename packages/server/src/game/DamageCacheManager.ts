import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { Colour, IVec2, Orientation, TilePos } from "@atbs/maths";
import { GameId, InstanceId } from "@atbs/shared-data";
import { PNG } from "pngjs";
import { Image } from "./Image.js";
import { ImageManager } from "./ImageManager.js";
import { Furniture } from "./Furniture.js";

interface LayerDamageState {
    damagedImageId: string;
    image: Image;
    filePath: string;
}

interface TileDamageState {
    furnitureId: InstanceId;
    layers: Map<string, LayerDamageState>;
}

export class DamageCacheManager {
    private readonly _gameId: GameId;
    private readonly _cacheDir: string;
    private readonly _instanceId?: number;
    private readonly _tileStates = new Map<string, TileDamageState>();

    constructor(gameId: GameId, instanceId?: number) {
        this._gameId = gameId;
        this._instanceId = instanceId;
        this._cacheDir = `./public/cache/damage/${gameId}/`;
    }

    get gameId(): GameId {
        return this._gameId;
    }

    private tileKey(tilePos: TilePos): string {
        return `${tilePos.col},${tilePos.row}`;
    }

    private damagedImageId(tilePos: TilePos, originalImageId: string): string {
        const base = `${this._gameId}-${tilePos.col}-${tilePos.row}-${originalImageId}`;
        return this._instanceId === undefined ? base : `${base}-i${this._instanceId}`;
    }

    private static stripInstanceSuffix(imageSuffix: string): string {
        return imageSuffix.replace(/-i\d+$/, "");
    }

    createRoundInstance(instanceId: number, imageManager: ImageManager): DamageCacheManager {
        const roundCache = new DamageCacheManager(this._gameId, instanceId);
        roundCache.copyFrom(this, imageManager);
        return roundCache;
    }

    private copyFrom(source: DamageCacheManager, imageManager: ImageManager): void {
        for (const [tileKey, sourceTileState] of source._tileStates) {
            const [col, row] = tileKey.split(",").map(Number);
            const tilePos = new TilePos(col, row);

            const tileState: TileDamageState = {
                furnitureId: sourceTileState.furnitureId,
                layers: new Map()
            };

            for (const [originalImageId, sourceLayer] of sourceTileState.layers) {
                tileState.layers.set(
                    originalImageId,
                    this.cloneLayerState(tilePos, originalImageId, sourceLayer.image, imageManager)
                );
            }

            this._tileStates.set(tileKey, tileState);
        }
    }

    private cloneLayerState(
        tilePos: TilePos,
        originalImageId: string,
        sourceImage: Image,
        imageManager: ImageManager
    ): LayerDamageState {
        const damagedImageId = this.damagedImageId(tilePos, originalImageId);
        const clonedImage = sourceImage.clone(damagedImageId);

        if (!existsSync(this._cacheDir)) {
            mkdirSync(this._cacheDir, { recursive: true });
        }

        const filePath = path.join(this._cacheDir, `${damagedImageId}.png`);
        writeFileSync(filePath, PNG.sync.write(clonedImage.png));
        imageManager.addImage(damagedImageId, this._cacheDir, clonedImage);

        return {
            damagedImageId,
            image: clonedImage,
            filePath
        };
    }

    adoptInto(gameCache: DamageCacheManager, imageManager: ImageManager): void {
        for (const [tileKey, roundTileState] of this._tileStates) {
            const [col, row] = tileKey.split(",").map(Number);
            const tilePos = new TilePos(col, row);

            for (const [originalImageId, roundLayer] of roundTileState.layers) {
                const furnitureStub = { id: roundTileState.furnitureId } as Furniture;
                const gameLayer = gameCache.getLayerState(tilePos, originalImageId);

                if (gameLayer) {
                    roundLayer.image.png.data.copy(gameLayer.image.png.data);
                    writeFileSync(gameLayer.filePath, PNG.sync.write(gameLayer.image.png));
                } else {
                    gameCache.importLayerFromImage(
                        tilePos,
                        furnitureStub,
                        originalImageId,
                        roundLayer.image,
                        imageManager
                    );
                }
            }
        }
    }

    private importLayerFromImage(
        tilePos: TilePos,
        furniture: Furniture,
        originalImageId: string,
        sourceImage: Image,
        imageManager: ImageManager
    ): void {
        const key = this.tileKey(tilePos);
        let tileState = this._tileStates.get(key);

        if (!tileState) {
            tileState = {
                furnitureId: furniture.id,
                layers: new Map()
            };
            this._tileStates.set(key, tileState);
        }

        tileState.layers.set(
            originalImageId,
            this.cloneLayerState(tilePos, originalImageId, sourceImage, imageManager)
        );
    }

    private getLayerState(tilePos: TilePos, originalImageId: string): LayerDamageState | undefined {
        return this._tileStates.get(this.tileKey(tilePos))?.layers.get(originalImageId);
    }

    ensureLayer(
        tilePos: TilePos,
        furniture: Furniture,
        originalImageId: string,
        imageManager: ImageManager
    ): LayerDamageState {
        const key = this.tileKey(tilePos);
        let tileState = this._tileStates.get(key);

        if (!tileState) {
            tileState = {
                furnitureId: furniture.id,
                layers: new Map()
            };
            this._tileStates.set(key, tileState);
        }

        const existingLayer = tileState.layers.get(originalImageId);
        if (existingLayer) {
            return existingLayer;
        }

        const sourceImage = imageManager.getImage(originalImageId);
        const damagedImageId = this.damagedImageId(tilePos, originalImageId);
        const clonedImage = sourceImage.clone(damagedImageId);

        if (!existsSync(this._cacheDir)) {
            mkdirSync(this._cacheDir, { recursive: true });
        }

        const filePath = path.join(this._cacheDir, `${damagedImageId}.png`);
        writeFileSync(filePath, PNG.sync.write(clonedImage.png));

        imageManager.addImage(damagedImageId, this._cacheDir, clonedImage);

        const layerState: LayerDamageState = {
            damagedImageId,
            image: clonedImage,
            filePath
        };

        tileState.layers.set(originalImageId, layerState);

        return layerState;
    }

    getImageIdOverride(originalImageId: string, tilePos: TilePos): string {
        const tileState = this._tileStates.get(this.tileKey(tilePos));
        const layerState = tileState?.layers.get(originalImageId);
        return layerState?.damagedImageId ?? originalImageId;
    }

    resolveOriginalImageId(imageId: string, tilePos: TilePos): string {
        const prefix = `${this._gameId}-${tilePos.col}-${tilePos.row}-`;
        if (imageId.startsWith(prefix)) {
            return DamageCacheManager.stripInstanceSuffix(imageId.slice(prefix.length));
        }

        return imageId;
    }

    getLayerImage(originalImageId: string, tilePos: TilePos): Image | undefined {
        return this._tileStates.get(this.tileKey(tilePos))?.layers.get(originalImageId)?.image;
    }

    clearPixels(
        tilePos: TilePos,
        furniture: Furniture,
        originalImageId: string,
        centerPos: IVec2,
        radiusPixels: number,
        orientation: Orientation,
        imageManager: ImageManager
    ): void {
        const layerState = this.ensureLayer(tilePos, furniture, originalImageId, imageManager);
        const { image } = layerState;
        const transparent = new Colour({ r: 0, g: 0, b: 0, a: 0 });

        for (let dy = -radiusPixels; dy <= radiusPixels; dy++) {
            for (let dx = -radiusPixels; dx <= radiusPixels; dx++) {
                if (dx * dx + dy * dy > radiusPixels * radiusPixels) {
                    continue;
                }

                const pos = { x: centerPos.x + dx, y: centerPos.y + dy };
                if (!image.tileBounds.isPointInside(pos)) {
                    continue;
                }

                image.setColour(pos, orientation, transparent);
            }
        }

        writeFileSync(layerState.filePath, PNG.sync.write(image.png));
    }

    removeTileCache(tilePos: TilePos, imageManager: ImageManager): void {
        const tileState = this._tileStates.get(this.tileKey(tilePos));
        if (!tileState) {
            return;
        }

        for (const { damagedImageId } of tileState.layers.values()) {
            imageManager.removeImage(damagedImageId);
        }

        this._tileStates.delete(this.tileKey(tilePos));
    }

    hasTileCache(tilePos: TilePos): boolean {
        return this._tileStates.has(this.tileKey(tilePos));
    }

    cleanup(imageManager: ImageManager): void {
        for (const tileState of this._tileStates.values()) {
            for (const { damagedImageId } of tileState.layers.values()) {
                imageManager.removeImage(damagedImageId);
            }
        }

        this._tileStates.clear();

        if (existsSync(this._cacheDir)) {
            rmSync(this._cacheDir, { recursive: true, force: true });
        }
    }
}
