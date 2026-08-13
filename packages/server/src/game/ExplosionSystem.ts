import {
    DeathAnimation,
    Explosion,
    FragmentExplosion,
    HitSpark,
    OnTarget,
    resolveJitteredValue,
    TimedTileUpdate,
    Tracer
} from "@atbs/shared-data";
import { DebugGraphic, degreesToRadians, generateRandomBetween, Vec2 } from "@atbs/maths";
import { buildUnitDeathAnimation } from "../AnimationDefinitions.js";
import { config } from "../config/config.schema.js";
import type { Game } from "./Game.js";
import { FurnitureDamageSystem } from "./FurnitureDamageSystem.js";
import { ImageManager } from "./ImageManager.js";
import type { Item } from "./Item.js";
import { Projectile } from "./Projectile.js";
import type { Unit } from "./Unit.js";

export interface ExplosionDetonationResult {
    tracers: Tracer[];
    tileUpdates: TimedTileUpdate[];
    deaths: DeathAnimation[];
    hitSparks: HitSpark[];
}

export interface DetonateExplosionProps {
    game: Game;
    origin: Vec2;
    explosion: Explosion;
    firingUnit: Unit;
    firingWeapon: Item;
    timeOffsetMs?: number;
    debugGraphics?: DebugGraphic[];
}

function offsetTimedTracePayload(
    result: ExplosionDetonationResult,
    timeOffsetMs: number
): ExplosionDetonationResult {
    if (timeOffsetMs === 0) {
        return result;
    }

    return {
        tracers: result.tracers.map((tracer) => ({
            ...tracer,
            segments: tracer.segments.map((segment) => ({
                ...segment,
                time: segment.time + timeOffsetMs
            }))
        })),
        tileUpdates: result.tileUpdates.map((update) => ({
            ...update,
            timeMs: update.timeMs + timeOffsetMs
        })),
        deaths: result.deaths.map((death) => ({
            ...death,
            startTimeMs: death.startTimeMs + timeOffsetMs
        })),
        hitSparks: result.hitSparks.map((spark) => ({
            ...spark,
            timeMs: spark.timeMs + timeOffsetMs
        }))
    };
}

function spawnFragmentProjectiles(
    props: DetonateExplosionProps,
    explosion: FragmentExplosion
): Projectile[] {
    const { game, origin, firingUnit, firingWeapon } = props;
    const fragmentCount = Math.max(1, Math.round(resolveJitteredValue(explosion.numFragments)));
    const angleStep = (Math.PI * 2) / fragmentCount;
    const angleJitterRadians = degreesToRadians(explosion.angleJitter);

    return [...Array(fragmentCount).keys()].map((projectileIndex) => {
        const jitter =
            angleJitterRadians > 0
                ? generateRandomBetween(-angleJitterRadians, angleJitterRadians)
                : 0;
        const angle = projectileIndex * angleStep + jitter;
        const directionVector = new Vec2(Math.cos(angle), Math.sin(angle));

        const intensity = resolveJitteredValue(explosion.visual.intensity);
        const velocity = resolveJitteredValue(explosion.visual.velocity);
        const trailLengthInPixels = resolveJitteredValue(explosion.visual.length);
        const rangeFalloffPower = resolveJitteredValue(explosion.visual.rangeFallOff);
        const maxRange = resolveJitteredValue(explosion.maxRange);
        const fragmentColour = { r: 255, g: 255, b: 255, a: intensity };

        const projectile = new Projectile({
            game,
            firingUnit,
            firingWeapon,
            projectileIndex,
            roundIndex: 0,
            srcPos: origin,
            directionVector,
            projectileRecipe: {
                numProjectiles: fragmentCount,
                variability: explosion.variability,
                maxRange,
                perturbation: 0,
                visual: {
                    headColour: fragmentColour,
                    headRadiusInPixels: 1,
                    trailColour: fragmentColour,
                    trailLengthInPixels,
                    rangeFalloffPower
                },
                damage: explosion.damage,
                mass: 0.001,
                velocity,
                diameter: 2,
                hardness: 0.5,
                shape: 0,
                stability: 0.1,
                bounce: 0,
                delivery: "fired",
                integrity: 0
            }
        });

        projectile.penetration = explosion.penetration;
        return projectile;
    });
}

function detonateFragmentExplosion(props: DetonateExplosionProps): ExplosionDetonationResult {
    const { game, explosion, debugGraphics } = props;
    if (explosion.type !== "fragment") {
        throw new Error(`Expected fragment explosion, got ${explosion.type}`);
    }

    const projectiles = spawnFragmentProjectiles(props, explosion);
    const imageManager = ImageManager.GetSingleton();
    const roundDamageCache = game.damageCacheManager.createRoundInstance(imageManager);
    const furnitureDamageSystem = new FurnitureDamageSystem(roundDamageCache, game.map.tileSize);

    const hitSparks = Projectile.ProcessProjectiles(
        projectiles,
        game.map,
        debugGraphics,
        roundDamageCache,
        furnitureDamageSystem,
        (projectile, tile, samplePos, sample, timeMs) => {
            furnitureDamageSystem.onMaterialPixel(projectile, tile, samplePos, sample, timeMs);
        }
    );

    const tileUpdates = [...furnitureDamageSystem.timedUpdates].sort((a, b) => a.timeMs - b.timeMs);
    const deaths = furnitureDamageSystem.unitDeaths.map(buildUnitDeathAnimation);
    roundDamageCache.adoptInto(game.damageCacheManager, imageManager);

    const tracers = config.showFragmentExplosionTracers
        ? projectiles.map((projectile) => projectile.getTracer())
        : [];

    return offsetTimedTracePayload(
        {
            tracers,
            tileUpdates,
            deaths,
            hitSparks
        },
        props.timeOffsetMs ?? 0
    );
}

/**
 * Detonate an explosion at a world position, spawning fragment projectiles for
 * fragment types. Gas / smoke / shockwave are stubs for a later pass.
 */
export function detonateExplosion(props: DetonateExplosionProps): ExplosionDetonationResult {
    switch (props.explosion.type) {
        case "fragment":
            return detonateFragmentExplosion(props);

        case "gas":
        case "smoke":
        case "shockwave":
            // TODO: Implement non-fragment explosion types.
            return { tracers: [], tileUpdates: [], deaths: [], hitSparks: [] };

        default: {
            const _exhaustive: never = props.explosion;
            throw new Error(`Unexpected explosion type: ${(_exhaustive as Explosion).type}`);
        }
    }
}

export interface ConsumeExplodedItemResult {
    tileUpdates: TimedTileUpdate[];
}

/**
 * Unregister a primed item and remove it from the map or holding unit inventory.
 */
export function consumeExplodedItem(
    game: Game,
    item: Item,
    primedBy: Unit | undefined,
    timeMs = 0
): ConsumeExplodedItemResult {
    game.primeManager.unregisterPrimedItem(item);

    const tileUpdates: TimedTileUpdate[] = [];

    if (item.location) {
        const tile = game.map.getTile(item.location);
        tile.removeItem(item);
        item.location = null;
        tileUpdates.push(tile.generateTimedTileUpdate(timeMs));
    } else if (primedBy?.inventory.findItem(item.id)) {
        primedBy.inventory.removeItem(item);
        tileUpdates.push(game.map.getTile(primedBy.mapLocation).generateTimedTileUpdate(timeMs));
    }

    game.itemManager.deleteItem(item.id);
    return { tileUpdates };
}

export function broadcastExplosionTrace(
    game: Game,
    result: ExplosionDetonationResult,
    isOnTarget: OnTarget = OnTarget.enum.none
): void {
    game.messageRouter.send({
        type: "server:fire:trace",
        payload: {
            tracers: result.tracers,
            isOnTarget,
            tileUpdates: result.tileUpdates,
            deaths: result.deaths,
            hitSparks: result.hitSparks
        }
    });

    if (result.deaths.length > 0) {
        game.visibilityManager.update();
        game.syncUnitsCanSee();
        for (const side of game.sides) {
            game.messageRouter.send(
                {
                    type: "server:visible:tiles",
                    payload: game.visibilityManager.getVisibilityUpdate(side.oppositionSideIds)
                },
                side.id
            );
        }
    }
}
