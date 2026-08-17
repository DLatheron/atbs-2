import {
    CloudExplosion,
    DamageMap,
    resolveJitteredValue,
    SideId,
    TimedAnimatableObject,
    TimedAnimatableObjectRemoval,
    TimedPlayAnimation,
    TimedVisibilityUpdate,
    VisibilityUpdate
} from "@atbs/shared-data";
import { generateRandomBetween, ITilePos, Orientation, TilePos, Vec2 } from "@atbs/maths";
import type { Game } from "./Game.js";
import { IMPENETRABLE } from "./Obstruction.js";
import { MaterialManager } from "./MaterialManager.js";
import { Vfx } from "./Vfx.js";
import type { ExplosionDetonationResult } from "./ExplosionSystem.js";

export const CLOUD_PARTICLE_STAGGER_MS = 400;

const CARDINAL_STEPS = [
    Orientation.NORTH,
    Orientation.EAST,
    Orientation.SOUTH,
    Orientation.WEST
] as const;

interface OpenTile {
    location: TilePos;
    fromLocation: TilePos;
}

function tileKey(location: ITilePos): string {
    return `${location.col},${location.row}`;
}

function passChance(obstruction: number | typeof IMPENETRABLE): number {
    if (obstruction === IMPENETRABLE || obstruction >= 100) {
        return 0;
    }
    if (obstruction <= 0) {
        return 1;
    }
    return (100 - obstruction) / 100;
}

function emptyCloudResult(): ExplosionDetonationResult {
    return {
        tracers: [],
        tileUpdates: [],
        deaths: [],
        hitSparks: [],
        animations: [],
        animObjects: [],
        animObjectRemovals: [],
        visibilityUpdatesBySide: new Map()
    };
}

function appendVisibility(result: ExplosionDetonationResult, game: Game, timeMs: number): void {
    if (!game.sides?.length) {
        return;
    }

    game.syncUnitsCanSee();

    const snapshots = result.visibilityUpdatesBySide ?? new Map<SideId, TimedVisibilityUpdate[]>();
    result.visibilityUpdatesBySide = snapshots;

    for (const side of game.sides) {
        const visibility: VisibilityUpdate = game.visibilityManager.getVisibilityUpdate(
            side.oppositionSideIds
        );
        const list = snapshots.get(side.id) ?? [];
        list.push({ timeMs, visibility });
        snapshots.set(side.id, list);
    }
}

export interface CloudGeneratorProps {
    game: Game;
    worldPos: Vec2;
    explosion: CloudExplosion;
}

export class CloudGenerator {
    private readonly _game: Game;
    private readonly _explosion: CloudExplosion;
    private readonly _cloudVfxs: Vfx[] = [];
    private readonly _occupied = new Set<string>();
    private _openList: OpenTile[];
    private _waveIndex = 0;
    private readonly _waveCounts: number[];
    private readonly _vfxId: string;
    private readonly _materials;
    private readonly _damageMap?: DamageMap;
    private readonly _disorientationPerFullTurn: number;
    private readonly _movementType: "smoke" | "gas";

    constructor({ game, worldPos, explosion }: CloudGeneratorProps) {
        this._game = game;
        this._explosion = explosion;
        this._movementType = explosion.type;
        this._waveCounts = explosion.particles.map((value) =>
            Math.max(1, Math.round(resolveJitteredValue(value)))
        );
        this._vfxId = explosion.vfxId ?? (explosion.type === "gas" ? "gas.vfx" : "smoke.vfx");
        const materialIds =
            explosion.materials && explosion.materials.length > 0
                ? explosion.materials
                : [explosion.type === "gas" ? "gas.material" : "smoke.material"];
        this._materials = materialIds.map((id) => MaterialManager.GetSingleton().getMaterial(id));
        this._damageMap = explosion.damage;
        this._disorientationPerFullTurn = explosion.disorientation ?? 0;

        const start = game.map.worldToTile(worldPos);
        this._openList = [{ location: start, fromLocation: start }];
    }

    get hasWorkRemaining(): boolean {
        return this._cloudVfxs.length > 0 || this._waveIndex < this._waveCounts.length;
    }

    tick(timeOffsetMs = 0): ExplosionDetonationResult {
        const result = emptyCloudResult();
        let timeMs = timeOffsetMs;

        timeMs = this._decayExisting(result, timeMs);
        this._generateWave(result, timeMs);

        return result;
    }

    private _decayExisting(result: ExplosionDetonationResult, timeMs: number): number {
        const { map, visibilityManager } = this._game;

        for (let i = this._cloudVfxs.length - 1; i >= 0; i--) {
            const vfx = this._cloudVfxs[i];
            if (vfx.decay()) {
                continue;
            }

            const tile = map.getTile(vfx.location);
            const worldPos = map.tileCenterToWorld(vfx.location);
            const disappear = vfx.buildDisappearPlayAnimation(worldPos);

            tile.removeVfx(vfx);
            this._game.vfxManager.removeVfx(vfx.id);
            this._cloudVfxs.splice(i, 1);
            this._occupied.delete(tileKey(vfx.location));

            visibilityManager.invalidateLocation(vfx.location);
            visibilityManager.update();

            const timed: TimedPlayAnimation[] = [];
            if (disappear) {
                timed.push({ playAnimation: disappear, startTimeMs: timeMs });
            }
            result.animations.push(...timed);
            result.animObjectRemovals ??= [];
            result.animObjectRemovals.push({
                instanceId: vfx.id,
                startTimeMs: timeMs
            } satisfies TimedAnimatableObjectRemoval);
            result.tileUpdates.push(tile.generateTimedTileUpdate(timeMs));
            appendVisibility(result, this._game, timeMs);

            timeMs += CLOUD_PARTICLE_STAGGER_MS;
        }

        return timeMs;
    }

    private _generateWave(result: ExplosionDetonationResult, timeMs: number): number {
        if (this._waveIndex >= this._waveCounts.length) {
            return timeMs;
        }

        const quota = this._waveCounts[this._waveIndex];
        this._waveIndex++;

        const retryNext: OpenTile[] = [];
        const spawned: OpenTile[] = [];
        const { map } = this._game;

        while (spawned.length < quota && this._openList.length > 0) {
            const candidate = this._openList.shift()!;
            const key = tileKey(candidate.location);

            if (this._occupied.has(key)) {
                continue;
            }

            const tile = map.sampleTile(candidate.location);
            if (!tile) {
                continue;
            }

            const obstruction = tile.getMovementObstruction(this._movementType);
            if (generateRandomBetween(0, 1) >= passChance(obstruction)) {
                retryNext.push(candidate);
                continue;
            }

            spawned.push(candidate);
            this._occupied.add(key);
            this._openList.push(
                ...CARDINAL_STEPS.map((orientation) => ({
                    location: candidate.location.stepInDirection(orientation),
                    fromLocation: candidate.location
                }))
            );
        }

        this._openList = [...retryNext, ...this._openList];

        const lifetimeTurns = Math.max(
            1,
            Math.round(resolveJitteredValue(this._explosion.lifetime))
        );

        for (const { location, fromLocation } of spawned) {
            const tile = map.getTile(location);
            const vfx = this._game.vfxManager.newVfx(this._vfxId, {
                location,
                fromLocation,
                lifetimeTurns,
                damageMap: this._damageMap,
                disorientationPerFullTurn: this._disorientationPerFullTurn,
                materials: this._materials
            });

            tile.addVfx(vfx);
            this._cloudVfxs.push(vfx);

            this._game.visibilityManager.invalidateLocation(location);
            this._game.visibilityManager.update();

            result.animObjects ??= [];
            result.animObjects.push({
                recipe: vfx.buildAnimatableObjectRecipe(),
                startTimeMs: timeMs
            } satisfies TimedAnimatableObject);
            result.tileUpdates.push(tile.generateTimedTileUpdate(timeMs));
            appendVisibility(result, this._game, timeMs);

            timeMs += CLOUD_PARTICLE_STAGGER_MS;
        }

        return timeMs;
    }
}
