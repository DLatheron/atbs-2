import {
    AnimationRecipe,
    DeathAnimation,
    Explosion,
    FragmentExplosion,
    HitSpark,
    OnTarget,
    resolveJitteredValue,
    ShockwaveExplosion,
    TimedPlayAnimation,
    TimedTileUpdate,
    Tracer
} from "@atbs/shared-data";
import { DebugGraphic, degreesToRadians, generateRandomBetween, Vec2 } from "@atbs/maths";
import { buildUnitDeathAnimation } from "../AnimationDefinitions.js";
import { config } from "../config/config.schema.js";
import { AnimationRecipeManager } from "./AnimationRecipeManager.js";
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
    animations: TimedPlayAnimation[];
}

export function collectDeferredDisorientationVisuals(game: Game): {
    tileUpdates: TimedTileUpdate[];
    animations: TimedPlayAnimation[];
} {
    const tileUpdates: TimedTileUpdate[] = [];
    const animations: TimedPlayAnimation[] = [];

    for (const side of game.sides ?? []) {
        for (const unit of side.units ?? []) {
            const deferred = unit.takeDeferredDisorientationVisual?.();
            if (!deferred) {
                continue;
            }

            animations.push(
                ...deferred.playAnimations.map((playAnimation) => ({
                    playAnimation,
                    startTimeMs: deferred.timeMs
                }))
            );

            const location = unit.mapLocation ?? unit.location;
            if (!location || !game.map) {
                continue;
            }

            tileUpdates.push(game.map.getTile(location).generateTimedTileUpdate(deferred.timeMs));
        }
    }

    tileUpdates.sort((a, b) => a.timeMs - b.timeMs);
    animations.sort((a, b) => a.startTimeMs - b.startTimeMs);
    return { tileUpdates, animations };
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

type RadialExplosion = FragmentExplosion | ShockwaveExplosion;

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
        })),
        animations: result.animations.map((animation) => ({
            ...animation,
            startTimeMs: animation.startTimeMs + timeOffsetMs
        }))
    };
}

function spawnRadialProjectiles(
    props: DetonateExplosionProps,
    explosion: RadialExplosion
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

function snapshotUnitDisorientation(game: Game): Map<string, number> {
    const snapshot = new Map<string, number>();
    for (const side of game.sides) {
        for (const unit of side.units) {
            snapshot.set(unit.id, unit.disorientation);
        }
    }
    return snapshot;
}

function broadcastDisorientationUpdates(game: Game, before: Map<string, number>): void {
    for (const side of game.sides) {
        for (const unit of side.units) {
            const previous = before.get(unit.id);
            if (previous === undefined || previous === unit.disorientation) {
                continue;
            }

            game.messageRouter.send(
                {
                    type: "server:unit:selected:update",
                    payload: {
                        id: unit.id,
                        disorientation: unit.disorientation
                    }
                },
                side.id
            );
        }
    }
}

function toDisorientationParticles(hitSparks: HitSpark[]): HitSpark[] {
    // ProcessProjectiles already emits disorientation-kind sparks for unit hits only.
    // Reduce the burst size for the 💫 VFX.
    return hitSparks
        .filter((spark) => spark.kind === "disorientation")
        .map((spark) => ({
            ...spark,
            count: Math.max(1, Math.ceil(spark.count / 4))
        }));
}

function scaleShockwaveAnimation(
    recipe: AnimationRecipe,
    maxRange: number,
    velocity: number,
    instanceId: string
): AnimationRecipe {
    const diameter = Math.max(1, maxRange * 2);
    // Match tracer travel: time (ms) = distance / speed * 1000.
    const expandDurationMs = Math.max(1, (maxRange / Math.max(velocity, 1)) * 1000);

    const scaleDef = recipe.stateDef.scale;
    let referenceDurationMs = 1000;
    if (Array.isArray(scaleDef) && scaleDef[1].length > 0) {
        referenceDurationMs = Math.max(
            1,
            ...scaleDef[1].map((step) => step.startOffset + step.duration)
        );
    }
    const timeScale = expandDurationMs / referenceDurationMs;

    const scaledScale: AnimationRecipe["stateDef"]["scale"] = [
        0,
        [
            {
                type: "linear" as const,
                startOffset: 0,
                duration: expandDurationMs,
                toValue: diameter
            }
        ]
    ];

    const scaleSequenceTiming = <T extends { startOffset: number; duration: number }>(
        step: T
    ): T => ({
        ...step,
        startOffset: step.startOffset * timeScale,
        duration: Math.max(1, step.duration * timeScale)
    });

    let scaledOpacity = recipe.stateDef.opacity;
    if (Array.isArray(scaledOpacity)) {
        const [initial, sequence] = scaledOpacity;
        scaledOpacity = [initial, sequence.map(scaleSequenceTiming)];
    }

    let scaledRotation = recipe.stateDef.rotation;
    if (Array.isArray(scaledRotation)) {
        const [initial, sequence] = scaledRotation;
        scaledRotation = [initial, sequence.map(scaleSequenceTiming)];
    }

    return {
        ...recipe,
        id: instanceId,
        stateDef: {
            ...recipe.stateDef,
            scale: scaledScale,
            opacity: scaledOpacity,
            rotation: scaledRotation
        }
    };
}

function buildShockwaveTimedAnimation(
    explosion: ShockwaveExplosion,
    origin: Vec2,
    maxRange: number,
    velocity: number
): TimedPlayAnimation {
    const baseRecipe = AnimationRecipeManager.GetSingleton().getRecipe(explosion.animationId);
    const instanceId = `shockwave-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const recipe = scaleShockwaveAnimation(baseRecipe, maxRange, velocity, instanceId);

    return {
        playAnimation: {
            instanceId,
            offset: 0,
            recipe,
            worldPos: { x: origin.x, y: origin.y }
        },
        startTimeMs: 0
    };
}

function detonateFragmentExplosion(props: DetonateExplosionProps): ExplosionDetonationResult {
    const { game, explosion, debugGraphics } = props;
    if (explosion.type !== "fragment") {
        throw new Error(`Expected fragment explosion, got ${explosion.type}`);
    }

    const projectiles = spawnRadialProjectiles(props, explosion);
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

    const disorientationVisuals = collectDeferredDisorientationVisuals(game);

    return offsetTimedTracePayload(
        {
            tracers,
            tileUpdates: [...tileUpdates, ...disorientationVisuals.tileUpdates].sort(
                (a, b) => a.timeMs - b.timeMs
            ),
            deaths,
            hitSparks,
            animations: disorientationVisuals.animations
        },
        props.timeOffsetMs ?? 0
    );
}

function detonateShockwaveExplosion(props: DetonateExplosionProps): ExplosionDetonationResult {
    const { game, explosion, origin, debugGraphics } = props;
    if (explosion.type !== "shockwave") {
        throw new Error(`Expected shockwave explosion, got ${explosion.type}`);
    }

    const resolvedMaxRange = resolveJitteredValue(explosion.maxRange);
    const resolvedVelocity = resolveJitteredValue(explosion.visual.velocity);
    const projectiles = spawnRadialProjectiles(props, explosion);
    const disorientationBefore = snapshotUnitDisorientation(game);

    const hitSparks = Projectile.ProcessProjectiles(
        projectiles,
        game.map,
        debugGraphics,
        undefined,
        undefined,
        undefined
    );

    broadcastDisorientationUpdates(game, disorientationBefore);

    const animation = buildShockwaveTimedAnimation(
        explosion,
        origin,
        resolvedMaxRange,
        resolvedVelocity
    );

    const tracers = config.showShockwaveExplosionTracers
        ? projectiles.map((projectile) => projectile.getTracer())
        : [];

    const disorientationVisuals = collectDeferredDisorientationVisuals(game);

    return offsetTimedTracePayload(
        {
            tracers,
            tileUpdates: disorientationVisuals.tileUpdates,
            deaths: [],
            hitSparks: toDisorientationParticles(hitSparks),
            animations: [animation, ...disorientationVisuals.animations]
        },
        props.timeOffsetMs ?? 0
    );
}

/**
 * Detonate an explosion at a world position. Fragment explosions spawn damaging
 * tracers; shockwave explosions apply LOS-blocked disorientation with a ring VFX.
 * Gas / smoke remain stubs.
 */
export function detonateExplosion(props: DetonateExplosionProps): ExplosionDetonationResult {
    switch (props.explosion.type) {
        case "fragment":
            return detonateFragmentExplosion(props);

        case "shockwave":
            return detonateShockwaveExplosion(props);

        case "gas":
        case "smoke":
            // TODO: Implement gas / smoke explosion types.
            return {
                tracers: [],
                tileUpdates: [],
                deaths: [],
                hitSparks: [],
                animations: []
            };

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
            hitSparks: result.hitSparks,
            animations: result.animations
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
