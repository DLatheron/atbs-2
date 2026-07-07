import { IVec2, Orientation, TilePos, Vec2 } from "@atbs/maths";
import { FurnitureState } from "@atbs/shared-data";
import { DamageCacheManager } from "./DamageCacheManager.js";
import { Furniture, isFurniture } from "./Furniture.js";
import { GridRayTraceHitResult } from "./GridRayTrace.js";
import { ImageManager } from "./ImageManager.js";
import { Projectile } from "./Projectile.js";
import { CollisionSample } from "./Tile.js";

export class FurnitureDamageSystem {
    private readonly _damageCache: DamageCacheManager;
    private readonly _imageManager: ImageManager;
    private readonly _tileSize: number;
    private readonly _hpDamageApplied = new Set<string>();

    constructor(damageCache: DamageCacheManager, tileSize: number) {
        this._damageCache = damageCache;
        this._imageManager = ImageManager.GetSingleton();
        this._tileSize = tileSize;
    }

    private hpDamageKey(projectile: Projectile, furniture: Furniture): string {
        return `${projectile.index}-${furniture.id}`;
    }

    private radiusPixels(projectile: Projectile): number {
        return Math.max(1, Math.round((projectile.diameter / 2) * (this._tileSize / 1000)));
    }

    onMaterialEntry(
        projectile: Projectile,
        event: GridRayTraceHitResult,
        dirtyTiles: Set<TilePos>
    ): void {
        const { owner, tile, pos } = event;
        if (!owner || !isFurniture(owner) || !tile) {
            return;
        }

        const furniture = owner;
        if (furniture.state === FurnitureState.enum.destroyed) {
            return;
        }

        const hpKey = this.hpDamageKey(projectile, furniture);
        if (!this._hpDamageApplied.has(hpKey)) {
            this._hpDamageApplied.add(hpKey);

            const destroyed = furniture.takeDamage(projectile.furnitureDamage);
            dirtyTiles.add(tile.location);

            if (destroyed) {
                this._damageCache.removeTileCache(tile.location, this._imageManager);
                return;
            }
        }

        if (furniture.pixelDestruction && event.imageId) {
            const localPos = projectile.map.worldToSubTile(tile.location, pos);
            this._applyPixelWear(
                projectile,
                furniture,
                tile.location,
                localPos,
                event.imageId,
                event.orientation ?? furniture.orientation
            );
            dirtyTiles.add(tile.location);
        }
    }

    onMaterialPixel(
        projectile: Projectile,
        tileLocation: TilePos,
        samplePos: Vec2,
        sample: CollisionSample,
        dirtyTiles: Set<TilePos>
    ): void {
        const { owner, imageId } = sample;
        if (!isFurniture(owner) || !owner.pixelDestruction) {
            return;
        }

        if (owner.state === FurnitureState.enum.destroyed) {
            return;
        }

        this._applyPixelWear(
            projectile,
            owner,
            tileLocation,
            samplePos,
            imageId,
            sample.orientation
        );
        dirtyTiles.add(tileLocation);
    }

    private _applyPixelWear(
        projectile: Projectile,
        furniture: Furniture,
        tilePos: TilePos,
        centerPos: IVec2,
        collisionImageId: string,
        orientation: Orientation
    ): void {
        const radiusPixels = this.radiusPixels(projectile);
        const originalCollisionId = this._damageCache.resolveOriginalImageId(
            collisionImageId,
            tilePos
        );
        const pairedLayers = furniture.getPairedImageIds();
        const pair = pairedLayers.find(({ collisionId }) => collisionId === originalCollisionId);

        if (!pair) {
            return;
        }

        this._damageCache.clearPixels(
            tilePos,
            furniture,
            pair.collisionId,
            centerPos,
            radiusPixels,
            orientation,
            this._imageManager
        );

        if (pair.visualId !== pair.collisionId) {
            this._damageCache.clearPixels(
                tilePos,
                furniture,
                pair.visualId,
                centerPos,
                radiusPixels,
                orientation,
                this._imageManager
            );
        }
    }
}
