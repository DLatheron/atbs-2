import { clamp, DebugGraphic, TilePos, Vec2, type IVec2 } from "@atbs/maths";
import { MaterialDensityType, SideId, TrackingSpeed } from "@atbs/shared-data";
import type { Game } from "./Game.js";
import { traceGridRay, walkCellBresenhamLine } from "./GridRayTrace.js";
import { IRayCast } from "./IRayCast.js";
import { ImageManager } from "./ImageManager.js";
import { Tile } from "./Tile.js";
import type { Unit } from "./Unit.js";
import type { WorldMap } from "./WorldMap.js";

/** Max camera error radius in world units when the hearer is at the edge of hearing range. */
export const MAX_HEARING_ERROR = 1500;

export interface EmitNoiseProps {
    worldPos: IVec2;
    noise: number;
    actingSideId: SideId;
    /** Extra tiles that count as "visible" for vision-wins (e.g. impact tiles). */
    relevantTilePoses?: TilePos[];
}

export interface HearingSample {
    unit: Unit;
    remainingLife: number;
    distance: number;
    maxDistance: number;
}

class AudioRay implements IRayCast {
    private readonly _srcPos: Vec2;
    private readonly _dstPos: Vec2;
    private _life: number;

    constructor(srcPos: Vec2, dstPos: Vec2, life: number) {
        this._srcPos = srcPos;
        this._dstPos = dstPos;
        this._life = life;
    }

    get srcPos(): Vec2 {
        return this._srcPos;
    }

    get dstPos(): Vec2 {
        return this._dstPos;
    }

    get life(): number {
        return this._life;
    }

    set life(value: number) {
        this._life = value;
    }

    get isRayAlive(): boolean {
        return this._life > 0;
    }
}

export interface AudioRayCastResult {
    heard: boolean;
    remainingLife: number;
    distance: number;
}

/**
 * Cast an attenuated audio ray from source to destination.
 * Life starts at `maxDistance` (world units). Distance traveled drains life 1:1;
 * opaque materials drain additional life via densityMap.audio.
 */
export function castAudioRay(
    map: WorldMap,
    srcPos: Vec2,
    dstPos: Vec2,
    maxDistance: number,
    options: {
        skipTilePos: TilePos;
        targetTilePos: TilePos;
    },
    debugGraphics?: DebugGraphic[]
): AudioRayCastResult {
    const distance = dstPos.sub(srcPos).length;
    if (maxDistance <= 0 || distance > maxDistance) {
        return { heard: false, remainingLife: 0, distance };
    }

    if (TilePos.IsEqual(options.skipTilePos, options.targetTilePos) || distance < 1e-6) {
        return { heard: true, remainingLife: Math.max(0, maxDistance - distance), distance };
    }

    const ray = new AudioRay(srcPos, dstPos, maxDistance);
    const grid = { aabb: map.worldBounds, gridScale: map.tileSize, subGrid: false };

    let reachedTarget = false;

    const blocked = traceGridRay(srcPos, dstPos, grid, (cellWalk) => {
        const tilePos = map.worldToTile(map.worldBounds.topLeft.add(cellWalk.cellOrigin));
        const tile = map.sampleTile(tilePos);
        if (!tile) {
            return undefined;
        }

        const segmentLength = cellWalk.dstPos.sub(cellWalk.srcPos).length;
        ray.life -= segmentLength;
        if (!ray.isRayAlive) {
            return { pos: cellWalk.srcPos, tile };
        }

        if (TilePos.IsEqual(tilePos, options.targetTilePos)) {
            reachedTarget = true;
            return { pos: cellWalk.srcPos, tile };
        }

        if (TilePos.IsEqual(tilePos, options.skipTilePos)) {
            return undefined;
        }

        if (!tile.anythingCollidable) {
            return undefined;
        }

        const collisionLayers = tile.getCollisionLayers(ImageManager.GetSingleton(), undefined, {
            includeVfx: true
        });
        if (collisionLayers.length === 0) {
            return undefined;
        }

        for (const samplePos of walkCellBresenhamLine(
            cellWalk.srcPos,
            cellWalk.dstPos,
            map.tileSize
        )) {
            const collisionSample = Tile.SampleCollisionLayers(samplePos, collisionLayers);
            if (!collisionSample) {
                continue;
            }

            const pixelCost = collisionSample.material.getDensityForType(
                MaterialDensityType.enum.audio
            );
            ray.life -= pixelCost;
            void debugGraphics;

            if (!ray.isRayAlive) {
                return {
                    pos: samplePos,
                    material: collisionSample.material,
                    tile
                };
            }
        }

        return undefined;
    });

    if (reachedTarget && ray.isRayAlive) {
        return { heard: true, remainingLife: ray.life, distance };
    }

    if (blocked || !ray.isRayAlive) {
        return { heard: false, remainingLife: 0, distance };
    }

    return {
        heard: ray.isRayAlive && distance <= maxDistance,
        remainingLife: ray.life,
        distance
    };
}

/** Deterministic 0..1 RNG from a string seed (mulberry32). */
export function seededUnitRandom(seed: string): () => number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let t = h >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

export function approximateHearingPosition(
    truePos: IVec2,
    distanceToBestHearer: number,
    maxDistanceForThatHearer: number,
    random: () => number,
    maxError: number = MAX_HEARING_ERROR
): Vec2 {
    const t = clamp(
        maxDistanceForThatHearer > 0 ? distanceToBestHearer / maxDistanceForThatHearer : 1,
        0,
        1
    );
    const errorRadius = maxError * t * t;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * errorRadius;
    return new Vec2(truePos).add({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
    });
}

export class HearingManager {
    private readonly _game: Game;
    private _noiseSeq = 0;

    constructor(game: Game) {
        this._game = game;
    }

    /** Test helper to reset the noise sequence counter. */
    resetNoiseSeq(value = 0): void {
        this._noiseSeq = value;
    }

    getMaxHearingDistance(hearer: Unit, noise: number): number {
        return hearer.hearingRange * (noise / 100);
    }

    sampleHearing(hearer: Unit, worldPos: IVec2, noise: number): HearingSample | null {
        if (hearer.isDead || noise <= 0) {
            return null;
        }

        const map = this._game.map;
        const hearerPos = map.tileCenterToWorld(hearer.mapLocation);
        const sourcePos = new Vec2(worldPos);
        const maxDistance = this.getMaxHearingDistance(hearer, noise);
        const sourceTile = map.worldToTile(sourcePos);
        const result = castAudioRay(map, sourcePos, hearerPos, maxDistance, {
            skipTilePos: sourceTile,
            targetTilePos: hearer.mapLocation
        });

        if (!result.heard) {
            return null;
        }

        return {
            unit: hearer,
            remainingLife: result.remainingLife,
            distance: result.distance,
            maxDistance
        };
    }

    findBestHearerForSide(sideId: SideId, worldPos: IVec2, noise: number): HearingSample | null {
        let best: HearingSample | null = null;
        for (const unit of this._game.getSide(sideId).units) {
            const sample = this.sampleHearing(unit, worldPos, noise);
            if (!sample) {
                continue;
            }
            if (
                !best ||
                sample.remainingLife > best.remainingLife ||
                (sample.remainingLife === best.remainingLife && sample.distance < best.distance)
            ) {
                best = sample;
            }
        }
        return best;
    }

    sideCanSeeNoise(
        sideId: SideId,
        worldPos: IVec2,
        relevantTilePoses: TilePos[] | undefined
    ): boolean {
        const side = this._game.getSide(sideId);
        const map = this._game.map;
        const originTilePos = map.worldToTile(new Vec2(worldPos));
        const originTile = map.sampleTile(originTilePos);
        if (originTile && side.canSee(originTile)) {
            return true;
        }
        for (const tilePos of relevantTilePoses ?? []) {
            const tile = map.sampleTile(tilePos);
            if (tile && side.canSee(tile)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Vision wins: if the side can see the noise origin (or relevant tiles), do nothing.
     * Hear-only: approximate camera pan. Neither: transmit nothing.
     */
    emitNoise(props: EmitNoiseProps): void {
        const { worldPos, noise, actingSideId, relevantTilePoses } = props;
        if (noise <= 0) {
            return;
        }

        const noiseSeq = this._noiseSeq++;
        let turn = 0;
        try {
            turn = this._game.turn;
        } catch {
            turn = 0;
        }
        const seed = `${this._game.id}:${turn}:${noiseSeq}`;

        for (const side of this._game.sides) {
            if (side.id === actingSideId) {
                continue;
            }

            if (this.sideCanSeeNoise(side.id, worldPos, relevantTilePoses)) {
                continue;
            }

            const best = this.findBestHearerForSide(side.id, worldPos, noise);
            if (!best) {
                continue;
            }

            const random = seededUnitRandom(`${seed}:${side.id}`);
            const approxPos = approximateHearingPosition(
                worldPos,
                best.distance,
                best.maxDistance,
                random
            );

            this._game.messageRouter.send(
                {
                    type: "server:camera:move:to",
                    payload: {
                        target: "world",
                        worldPos: approxPos,
                        trackingSpeed: TrackingSpeed.enum.VERY_FAST
                    }
                },
                side.id
            );
        }
    }
}
