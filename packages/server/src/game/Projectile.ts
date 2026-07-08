import {
    Colour,
    DebugGraphic,
    DebugGraphicType,
    generateRandomBetween,
    minDistanceFromPointToPathSegments,
    PathSegment,
    Vec2
} from "@atbs/maths";
import { Game } from "./Game.js";
import { Item } from "./Item.js";
import { isUnit, type Unit } from "./Unit.js";
import { ProjectileRecipe } from "./ItemRecipe.js";
import { WorldMap } from "./WorldMap.js";
import { Tracer } from "@atbs/shared-data";
import { Logger, LowestFirst, Priority, PriorityQueue } from "@atbs/misc";
import { isFurniture } from "./Furniture.js";
import { GridRayTraceHitResult } from "./GridRayTrace.js";
import { IRayCast } from "./IRayCast.js";
import { ImageManager } from "./ImageManager.js";
import { PenetrationSystem } from "./PenetrationSystem.js";
import { config } from "../config/config.schema.js";
import { DamageCacheManager } from "./DamageCacheManager.js";
import { FurnitureDamageSystem } from "./FurnitureDamageSystem.js";
import { CollisionSample, Tile } from "./Tile.js";

interface CollisionEvent extends Priority, GridRayTraceHitResult {
    projectile: Projectile;
}

export class CollisionEventQueue extends PriorityQueue<CollisionEvent> {
    constructor() {
        super(LowestFirst);
    }
}

export interface Impact {
    pos: Vec2;
    time: number;
}

/** Travel speed shared by fired rounds for consistent projectile animation timing. */
export const DEFAULT_PROJECTILE_TRAVEL_VELOCITY = 600;

export interface ProjectileProps {
    game: Game;
    firingUnit: Unit;
    firingWeapon: Item;

    projectileIndex: number;
    roundIndex: number;
    srcPos: Vec2;
    directionVector: Vec2;
    projectileRecipe: ProjectileRecipe;
}

export class Projectile implements IRayCast {
    static readonly Logger: Logger = new Logger("Projectile", config.logLevels?.projectile);

    private readonly _props: ProjectileProps;

    private _srcPos: Vec2;
    private _dstPos: Vec2;
    private _maxRange: number;
    private _directionVector: Vec2;
    private _velocity: number;
    private _impactVelocity: number;
    private readonly _syncAnimationToImpact: boolean;
    private _penetration: number;
    private _segments: PathSegment[];

    private _impact?: Impact;

    constructor(props: ProjectileProps) {
        const variability =
            props.projectileIndex === 0 || !props.projectileRecipe.variability
                ? 1
                : generateRandomBetween(
                      props.projectileRecipe.variability.min,
                      props.projectileRecipe.variability.max
                  );
        console.info(
            `Projectile: ${props.projectileIndex} variability: ${variability}`,
            props.projectileRecipe.variability
        );

        this._props = props;

        this._srcPos = new Vec2(props.srcPos);
        this._dstPos = this.srcPos.add(
            props.directionVector.scale(props.projectileRecipe.maxRange)
        );
        this._maxRange = props.projectileRecipe.maxRange * variability;
        this._directionVector = props.directionVector;
        this._velocity = props.projectileRecipe.velocity * variability;
        this._syncAnimationToImpact = props.projectileRecipe.impactVelocity == null;
        this._impactVelocity =
            (props.projectileRecipe.impactVelocity ?? props.projectileRecipe.velocity) *
            variability;
        this._penetration = PenetrationSystem.calcInitialEnergy(this);
        this._segments = [
            {
                pos: props.srcPos,
                time: 0
            }
        ];

        this._impact = undefined;
    }

    get game(): Game {
        return this._props.game;
    }

    get map(): WorldMap {
        return this.game.map;
    }

    get firingUnit(): Unit {
        return this._props.firingUnit;
    }

    get firingWeapon(): Item {
        return this._props.firingWeapon;
    }

    get index(): number {
        return this._props.projectileIndex;
    }

    get roundIndex(): number {
        return this._props.roundIndex ?? 0;
    }

    get srcPos(): Vec2 {
        return this._srcPos;
    }

    get dstPos(): Vec2 {
        return this._dstPos;
    }

    get directionVector(): Vec2 {
        return this._directionVector;
    }

    get maxRange(): number {
        return this._maxRange;
    }

    get velocity(): number {
        return this._velocity;
    }

    set velocity(value: number) {
        this._velocity = value;
    }

    get impactVelocity(): number {
        return this._impactVelocity;
    }

    set impactVelocity(value: number) {
        this._impactVelocity = Math.max(value, 0);
    }

    retainImpactVelocity(value: number): void {
        this._impactVelocity = value;
        if (this._syncAnimationToImpact) {
            this._velocity = value;
        }
    }

    get penetration(): number {
        return this._penetration;
    }

    set penetration(value: number) {
        this._penetration = Math.max(value, 0);
    }

    get life(): number {
        return this.penetration;
    }

    set life(value: number) {
        this.penetration = value;
    }

    get isRayAlive(): boolean {
        return this.penetration > 0;
    }

    get segments(): PathSegment[] {
        return this._segments;
    }

    get impact(): Impact | undefined {
        return this._impact;
    }

    set impact(value: Impact | undefined) {
        this._impact = value;
    }

    get finalPostionAndTime(): { pos: Vec2; time: number } {
        const pos = this.impact?.pos ?? this.dstPos;
        const time = this.impact?.time ?? this.calculateTimeTo(this.dstPos);

        return { pos, time };
    }

    get mass(): number {
        return this._props.projectileRecipe.mass;
    }

    get hardness(): number {
        return this._props.projectileRecipe.hardness;
    }

    get shape(): number {
        return this._props.projectileRecipe.shape;
    }

    get stability(): number {
        return this._props.projectileRecipe.stability;
    }

    get bounce(): number {
        return this._props.projectileRecipe.bounce;
    }

    get delivery(): ProjectileRecipe["delivery"] {
        return this._props.projectileRecipe.delivery;
    }

    get projectileRecipe(): ProjectileRecipe {
        return this._props.projectileRecipe;
    }

    get diameter(): number {
        return this._props.projectileRecipe.diameter;
    }

    get furnitureDamage(): number {
        return this._props.projectileRecipe.damage.default;
    }

    changeDirection(newDirection: Vec2) {
        this._dstPos = this.srcPos.add(newDirection.scale(this.maxRange));
        this._directionVector = newDirection;
    }

    /** Move the ray origin off a surface to avoid immediately re-hitting it after ricochet. */
    nudgeFromSurface(distance: number) {
        this._srcPos = this._srcPos.add(this._directionVector.scale(distance));
        this._dstPos = this._srcPos.add(this._directionVector.scale(this.maxRange));
    }

    calculateTimeTo(pos: Vec2): number {
        const length = pos.sub(this.srcPos).length;
        return (length / this.velocity) * 1000;
    }

    passesNear(target: Vec2, thresholdPx = 1): boolean {
        const path = this._buildCompletePath();
        return minDistanceFromPointToPathSegments(target, path) <= thresholdPx;
    }

    private _buildCompletePath(): PathSegment[] {
        const path = [...this._segments];

        if (this.impact) {
            path.push({ time: this.impact.time, pos: this.impact.pos });
        } else {
            const previousTime = path[path.length - 1].time;
            const endPos = this.dstPos;
            path.push({ time: previousTime + this.calculateTimeTo(endPos), pos: endPos });
        }

        return path;
    }

    getTracer(): Tracer {
        const path = this._buildCompletePath();
        const lastSegment = path[path.length - 1];

        Projectile.Logger.info(`Commit end segment ${lastSegment.time}:${lastSegment.pos}`);
        this.commitSegmentTo(lastSegment.time, new Vec2(lastSegment.pos));

        const { velocity } = this;
        const {
            headColour,
            headRadiusInPixels,
            trailColour,
            trailLengthInPixels,
            rangeFalloffPower
        } = this._props.projectileRecipe.visual;
        const trailLengthInMs = (trailLengthInPixels / velocity) * 1000;
        const maxRangeInMs = (this.maxRange / velocity) * 1000;

        return {
            segments: this.segments,
            headRadiusInPixels,
            headColour,
            trailLengthInMs,
            trailColour,
            maxRangeInMs,
            rangeFalloffPower
        };
    }

    commitSegmentTo(time: number, pos: Vec2): void {
        this._segments.push({ pos, time });

        // Reset projectile for next segment.
        this._srcPos = pos;
        this._impact = undefined;
    }

    private static queueRicochetRay(
        map: WorldMap,
        projectile: Projectile,
        atTime: number,
        eventQueue: CollisionEventQueue,
        debugGraphics?: DebugGraphic[],
        damageCache?: DamageCacheManager
    ): void {
        const hitResult = map.castRay(projectile, debugGraphics, damageCache);
        if (hitResult) {
            const timeTo = projectile.calculateTimeTo(hitResult.pos);
            const cumulativeTime = atTime + timeTo;

            Projectile.Logger.dir(
                `Projectile: ${projectile.index} ricocheted, next hit in ${timeTo}ms at ${hitResult.pos}`
            );
            projectile.impact = { pos: hitResult.pos, time: cumulativeTime };

            eventQueue.push({
                priority: cumulativeTime,
                projectile,
                ...hitResult
            });
        }

        debugGraphics?.push({
            type: DebugGraphicType.enum.line,
            srcWorldPos: projectile.srcPos,
            dstWorldPos: projectile.impact?.pos ?? projectile.dstPos,
            strokeColour: Colour.Magenta,
            strokeThickness: 2,
            lineDash: [4, 2]
        });
    }

    static ProcessProjectiles(
        projectiles: Projectile[],
        map: WorldMap,
        debugGraphics?: DebugGraphic[],
        damageCache?: DamageCacheManager,
        furnitureDamageSystem?: FurnitureDamageSystem,
        onMaterialPixel?: (
            projectile: Projectile,
            tile: Tile,
            samplePos: Vec2,
            sample: CollisionSample,
            timeMs: number
        ) => void
    ): void {
        const imageManager = ImageManager.GetSingleton();

        // Sort so that fastest projectiles are first.
        projectiles.sort((a, b) => b.velocity - a.velocity);

        const eventQueue = new CollisionEventQueue();

        // Determine the initial impact of every projectile.
        for (const projectile of projectiles) {
            const hitResult = map.castRay(projectile, debugGraphics, damageCache);

            if (hitResult) {
                const timeTo = projectile.calculateTimeTo(hitResult.pos);
                Projectile.Logger.dir(
                    `Projectile: ${projectile.index} took ${timeTo}ms to hit ${hitResult.pos}`
                );
                projectile.impact = { pos: hitResult.pos, time: timeTo };

                eventQueue.push({
                    priority: timeTo,
                    projectile,
                    ...hitResult
                });
            }

            debugGraphics?.push({
                type: DebugGraphicType.enum.line,
                srcWorldPos: projectile.srcPos,
                dstWorldPos: projectile.impact?.pos ?? projectile.dstPos,
                strokeColour: Colour.White,
                strokeThickness: 2
            });
        }

        if (eventQueue.isEmpty) {
            return;
        }

        let event: CollisionEvent;

        while ((event = eventQueue.pop())) {
            const { priority: atTime, material, exitedMaterial, owner, pos, projectile } = event;
            Projectile.Logger.dir({ priority: atTime, pos });

            if (material) {
                Projectile.Logger.info(`Commit material entry segment ${atTime}:${pos}`);
                projectile.commitSegmentTo(atTime, pos);

                if (isFurniture(owner)) {
                    Projectile.Logger.info("Collided with furniture!", owner.id);
                    furnitureDamageSystem?.onMaterialEntry(projectile, event, atTime);
                } else if (isUnit(owner)) {
                    Projectile.Logger.info("Collided with unit!", owner.id);
                }

                const entryOutcome = PenetrationSystem.resolveMaterialEntry(
                    map,
                    imageManager,
                    projectile,
                    material,
                    pos,
                    debugGraphics
                );

                if (entryOutcome === "stopped") {
                    projectile.impact = { pos, time: atTime };
                    continue;
                }

                if (entryOutcome === "ricocheted") {
                    Projectile.queueRicochetRay(
                        map,
                        projectile,
                        atTime,
                        eventQueue,
                        debugGraphics,
                        damageCache
                    );
                    continue;
                }

                const nextChange = map.stepRay(
                    projectile,
                    material,
                    debugGraphics,
                    damageCache,
                    onMaterialPixel
                        ? (tile, samplePos, sample) => {
                              const worldPos = map.tileOffsetToWorld(tile.location, samplePos);
                              const timeMs = atTime + projectile.calculateTimeTo(worldPos);
                              onMaterialPixel(projectile, tile, samplePos, sample, timeMs);
                          }
                        : undefined
                );
                if (nextChange) {
                    debugGraphics?.push({
                        type: DebugGraphicType.enum.line,
                        srcWorldPos: pos,
                        dstWorldPos: nextChange.pos,
                        strokeColour: Colour.Red,
                        strokeThickness: 2,
                        lineDash: [2, 2]
                    });

                    const timeTo = projectile.calculateTimeTo(nextChange.pos);
                    const cumulativeTime = atTime + timeTo;

                    if (projectile.life > 0) {
                        eventQueue.push({
                            priority: cumulativeTime,
                            projectile,
                            ...nextChange
                        });
                    } else {
                        projectile.impact = { pos: nextChange.pos, time: cumulativeTime };
                    }
                }
            } else {
                Projectile.Logger.info(`Commit material exit segment ${atTime}:${pos}`);
                projectile.commitSegmentTo(atTime, pos);

                if (exitedMaterial) {
                    PenetrationSystem.resolveMaterialExit(
                        map,
                        imageManager,
                        projectile,
                        exitedMaterial,
                        pos,
                        debugGraphics
                    );
                }

                const hitResult = map.castRay(projectile, debugGraphics, damageCache);
                if (hitResult) {
                    const timeTo = projectile.calculateTimeTo(hitResult.pos);
                    const cumulativeTime = atTime + timeTo;

                    Projectile.Logger.dir(
                        `Projectile: ${projectile.index} took ${timeTo}ms to hit ${hitResult.pos}`
                    );
                    projectile.impact = { pos: hitResult.pos, time: cumulativeTime };

                    eventQueue.push({
                        priority: cumulativeTime,
                        projectile,
                        ...hitResult
                    });
                }

                debugGraphics?.push({
                    type: DebugGraphicType.enum.line,
                    srcWorldPos: projectile.srcPos,
                    dstWorldPos: projectile.impact?.pos ?? projectile.dstPos,
                    strokeColour: Colour.White,
                    strokeThickness: 2
                });
            }
        }
    }
}
