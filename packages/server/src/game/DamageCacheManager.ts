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
    private readonly _tileStates = new Map<string, TileDamageState>();

    constructor(gameId: GameId) {
        this._gameId = gameId;
        this._cacheDir = `./public/cache/damage/${gameId}/`;
    }

    get gameId(): GameId {
        return this._gameId;
    }

    private tileKey(tilePos: TilePos): string {
        return `${tilePos.col},${tilePos.row}`;
    }

    private damagedImageId(tilePos: TilePos, originalImageId: string): string {
        return `${this._gameId}-${tilePos.col}-${tilePos.row}-${originalImageId}`;
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
            return imageId.slice(prefix.length);
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
