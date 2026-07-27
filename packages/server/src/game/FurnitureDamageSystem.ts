import { IVec2, Orientation, TilePos, Vec2 } from "@atbs/maths";
import { FurnitureState, RenderImage, RenderMode, TimedTileUpdate } from "@atbs/shared-data";
import { DEATH_DURATION_MS, UnitDeathRecord, unitDeathAnimId } from "../AnimationDefinitions.js";
import { DamageCacheManager } from "./DamageCacheManager.js";
import { Furniture, isFurniture } from "./Furniture.js";
import { GridRayTraceHitResult } from "./GridRayTrace.js";
import { ImageManager } from "./ImageManager.js";
import { Projectile } from "./Projectile.js";
import { CollisionSample, Tile } from "./Tile.js";
import type { Unit } from "./Unit.js";

export class FurnitureDamageSystem {
    private readonly _damageCache: DamageCacheManager;
    private readonly _imageManager: ImageManager;
    private readonly _tileSize: number;
    private readonly _hpDamageApplied = new Set<string>();
    private readonly _timedUpdates: TimedTileUpdate[] = [];
    private readonly _unitDeaths: UnitDeathRecord[] = [];

    constructor(damageCache: DamageCacheManager, tileSize: number) {
        this._damageCache = damageCache;
        this._imageManager = ImageManager.GetSingleton();
        this._tileSize = tileSize;
    }

    get timedUpdates(): readonly TimedTileUpdate[] {
        return this._timedUpdates;
    }

    get unitDeaths(): readonly UnitDeathRecord[] {
        return this._unitDeaths;
    }

    private hpDamageKey(projectile: Projectile, furniture: Furniture): string {
        return `${projectile.roundIndex}-${projectile.index}-${furniture.id}`;
    }

    private radiusPixels(projectile: Projectile): number {
        return Math.max(1, Math.round((projectile.diameter / 2) * (this._tileSize / 1000)));
    }

    private upsertTimedUpdate(update: TimedTileUpdate): void {
        const existingIndex = this._timedUpdates.findIndex(
            (existing) =>
                existing.timeMs === update.timeMs &&
                TilePos.IsEqual(existing.tilePos, update.tilePos)
        );

        if (existingIndex >= 0) {
            this._timedUpdates[existingIndex] = update;
        } else {
            this._timedUpdates.push(update);
        }
    }

    private recordTileUpdate(timeMs: number, tile: Tile): void {
        this.upsertTimedUpdate({
            timeMs,
            tilePos: tile.location,
            tileByRenderMode: {
                [RenderMode.enum.MAP_MODE]: tile.getRenderList(
                    {
                        renderMode: RenderMode.enum.MAP_MODE,
                        states: []
                    },
                    this._damageCache
                ),
                [RenderMode.enum.FIRE_MODE]: tile.getRenderList(
                    {
                        renderMode: RenderMode.enum.FIRE_MODE,
                        states: []
                    },
                    this._damageCache
                )
            }
        });
    }

    private recordDeathPlaceholderUpdate(timeMs: number, tile: Tile, animImageId: string): void {
        const injectedImage: RenderImage = { imageId: animImageId };

        this.upsertTimedUpdate({
            timeMs,
            tilePos: tile.location,
            tileByRenderMode: {
                [RenderMode.enum.MAP_MODE]: tile.getRenderListExcludingUnits(
                    {
                        renderMode: RenderMode.enum.MAP_MODE,
                        states: []
                    },
                    injectedImage,
                    this._damageCache
                ),
                [RenderMode.enum.FIRE_MODE]: tile.getRenderListExcludingUnits(
                    {
                        renderMode: RenderMode.enum.FIRE_MODE,
                        states: []
                    },
                    injectedImage,
                    this._damageCache
                )
            }
        });
    }

    onUnitDeath(tile: Tile, unit: Unit, timeMs: number, roundIndex: number): void {
        const animImageId = unitDeathAnimId(unit.id, roundIndex);

        this._unitDeaths.push({
            unitId: unit.id,
            orientation: unit.orientation,
            itemInUse: Boolean(unit.itemInUse),
            worldPos: tile.aabb.middleCenter,
            timeMs,
            roundIndex,
            scale: this._tileSize
        });

        // Start: replace the (now dead) unit with the spinning death animation placeholder.
        this.recordDeathPlaceholderUpdate(timeMs, tile, animImageId);

        // End: settle to the normal dead-sprite tile render list once the spin completes.
        this.recordTileUpdate(timeMs + DEATH_DURATION_MS, tile);
    }

    onMaterialEntry(projectile: Projectile, event: GridRayTraceHitResult, timeMs: number): void {
        if (projectile.delivery === "thrown") {
            return;
        }

        const { owner, tile, pos } = event;
        if (!owner || !isFurniture(owner) || !tile) {
            return;
        }

        const furniture = owner;
        if (furniture.state === FurnitureState.enum.destroyed) {
            return;
        }

        let tileChanged = false;

        const hpKey = this.hpDamageKey(projectile, furniture);
        if (!this._hpDamageApplied.has(hpKey)) {
            this._hpDamageApplied.add(hpKey);

            const destroyed = furniture.takeDamage(projectile.furnitureDamage);
            tileChanged = true;

            if (destroyed) {
                this._damageCache.removeTileCache(tile.location, this._imageManager);
                this.recordTileUpdate(timeMs, tile);
                return;
            }
        }

        if (furniture.pixelDestruction && event.imageId) {
            const localPos = projectile.map.worldToSubTile(tile.location, pos);
            const pixelsCleared = this._applyPixelWear(
                projectile,
                furniture,
                tile.location,
                localPos,
                event.imageId,
                event.orientation ?? furniture.orientation
            );
            tileChanged ||= pixelsCleared;
        }

        if (tileChanged) {
            this.recordTileUpdate(timeMs, tile);
        }
    }

    onMaterialPixel(
        projectile: Projectile,
        tile: Tile,
        samplePos: Vec2,
        sample: CollisionSample,
        timeMs: number
    ): void {
        const { owner, imageId } = sample;
        if (!isFurniture(owner) || !owner.pixelDestruction) {
            return;
        }

        if (owner.state === FurnitureState.enum.destroyed) {
            return;
        }

        const pixelsCleared = this._applyPixelWear(
            projectile,
            owner,
            tile.location,
            samplePos,
            imageId,
            sample.orientation
        );

        if (pixelsCleared) {
            this.recordTileUpdate(timeMs, tile);
        }
    }

    private _applyPixelWear(
        projectile: Projectile,
        furniture: Furniture,
        tilePos: TilePos,
        centerPos: IVec2,
        collisionImageId: string,
        orientation: Orientation
    ): boolean {
        const radiusPixels = this.radiusPixels(projectile);
        const originalCollisionId = this._damageCache.resolveOriginalImageId(
            collisionImageId,
            tilePos
        );
        const pairedLayers = furniture.getPairedImageIds();
        const pair = pairedLayers.find(({ collisionId }) => collisionId === originalCollisionId);

        if (!pair) {
            return false;
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

        return true;
    }
}
