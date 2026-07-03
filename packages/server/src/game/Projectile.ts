import { Colour, DebugGraphic, DebugGraphicType, PathSegment, Vec2 } from "@atbs/maths";
import { Game } from "./Game.js";
import { Item } from "./Item.js";
import { isUnit, type Unit } from "./Unit.js";
import { ProjectileRecipe } from "./ItemRecipe.js";
import { WorldMap } from "./WorldMap.js";
import { Tracer } from "@atbs/shared-data";
import { LowestFirst, Priority, PriorityQueue } from "@atbs/misc";
import { isFurniture } from "./Furniture.js";
import { GridRayTraceHitResult } from "./GridRayTrace.js";
import { IRayCast } from "./IRayCast.js";
import { ImageManager } from "./ImageManager.js";
import { Material, MaterialPerturbation, PerturbationType } from "./Material.js";
import { generateRandomBetween } from "../../../maths/src/Maths.js";

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

export interface ProjectileProps {
    game: Game;
    firingUnit: Unit;
    firingWeapon: Item;

    index: number;
    srcPos: Vec2;
    directionVector: Vec2;
    projectileRecipe: ProjectileRecipe;
}

export class Projectile implements IRayCast {
    private readonly _props: ProjectileProps;

    private _srcPos: Vec2;
    private _dstPos: Vec2;
    private _maxRange: number;
    private _directionVector: Vec2;
    private _velocity: number;
    private _penetration: number;
    private _segments: PathSegment[];

    private _impact?: Impact;

    constructor(props: ProjectileProps) {
        this._props = props;

        this._srcPos = new Vec2(props.srcPos);
        this._dstPos = this.srcPos.add(
            props.directionVector.scale(props.projectileRecipe.maxRange)
        );
        this._maxRange = props.projectileRecipe.maxRange;
        this._directionVector = props.directionVector;
        this._velocity = props.projectileRecipe.visual.velocityInPps;
        this._penetration = this.maxPenetration;
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
        return this._props.index;
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

    get maxPenetration(): number {
        return this._props.projectileRecipe.penetration;
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

    isRicocheted(material: Material): MaterialPerturbation | undefined {
        const { perturbation } = this._props.projectileRecipe;
        const materialPerturbation = material.getPerturbation(PerturbationType.enum.ricochet);
        if (!materialPerturbation) {
            return;
        }

        const chance = perturbation * (materialPerturbation?.chance ?? 0);
        const random = generateRandomBetween(0, 100);
        if (random >= chance) {
            return;
        }

        return materialPerturbation;
    }

    isPerturbed(material: Material): MaterialPerturbation | undefined {
        const { perturbation } = this._props.projectileRecipe;
        const materialPerturbation = material.getPerturbation(PerturbationType.enum.entry);
        if (!materialPerturbation) {
            return;
        }

        const chance = perturbation * (materialPerturbation?.chance ?? 0);
        const random = generateRandomBetween(0, 100);
        if (random >= chance) {
            return;
        }

        return materialPerturbation;
    }

    ricochet(normal: Vec2, perturbation: MaterialPerturbation) {
        const reflectedDir = this.directionVector.reflect(normal);
        const perturbedReflectedDir = reflectedDir.perturbVector(
            perturbation.angleInDegrees,
            perturbation.angularFalloffPower
        );

        this._dstPos = this.srcPos.add(perturbedReflectedDir.scale(this.maxRange));
        this._directionVector = perturbedReflectedDir;
    }

    perturb(newDirection: Vec2, perturbation: MaterialPerturbation) {
        const perturbedNewDirection = newDirection.perturbVector(
            perturbation.angleInDegrees,
            perturbation.angularFalloffPower
        );

        this._dstPos = this.srcPos.add(perturbedNewDirection.scale(this.maxRange));
        this._directionVector = perturbedNewDirection;
    }

    calculateTimeTo(pos: Vec2): number {
        const length = pos.sub(this.srcPos).length;
        return (length / this.velocity) * 1000;
    }

    getTracer(): Tracer {
        if (this.impact) {
            console.info(`Commit impact segment ${this.impact.time}:${this.impact.pos}`);
            this.commitSegmentTo(this.impact.time, this.impact.pos);
        } else {
            const previousTime = this.segments[this.segments.length - 1].time;
            const endPos = this.dstPos;
            const timeAtEnd = this.calculateTimeTo(endPos);

            console.info(`Commit end segment ${timeAtEnd}:${endPos}`);
            this.commitSegmentTo(previousTime + timeAtEnd, endPos);
        }

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

    static ProcessProjectiles(
        projectiles: Projectile[],
        map: WorldMap,
        debugGraphics?: DebugGraphic[]
    ) {
        // Sort so that fastest projectiles are first.
        projectiles.sort((a, b) => b.velocity - a.velocity);

        const eventQueue = new CollisionEventQueue();

        // Determine the initial impact of every projectile.
        for (const projectile of projectiles) {
            const hitResult = map.castRay(projectile, debugGraphics);

            if (hitResult) {
                const timeTo = projectile.calculateTimeTo(hitResult.pos);
                console.dir(
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

        // No collisions to process - just the projectiles reaching their maximum range.
        if (eventQueue.isEmpty) {
            return;
        }

        // We now have an timed-based queue of events.
        let event: CollisionEvent;

        // Process the first event and see what happens.
        while ((event = eventQueue.pop())) {
            const { priority: atTime, material, owner, pos, projectile } = event;
            console.dir({ priority: atTime, pos });

            if (material) {
                console.info(`Commit material entry segment ${atTime}:${pos}`);
                projectile.commitSegmentTo(atTime, pos);

                // TODO: Apply damage 'atTime'... (or at nextChange time?)

                // Apply damage to material owner.
                if (isFurniture(owner)) {
                    console.info("Collided with furniture!", owner.id);
                } else if (isUnit(owner)) {
                    console.info("Collided with unit!", owner.id);
                }

                const ricochetPerturbation = projectile.isRicocheted(material);
                if (ricochetPerturbation) {
                    const normal = map.calcNormal(ImageManager.GetSingleton(), pos);
                    if (normal) {
                        projectile.ricochet(normal, ricochetPerturbation);
                    }
                } else {
                    const entryPerturbation = projectile.isPerturbed(material);
                    if (entryPerturbation) {
                        projectile.perturb(projectile.directionVector, entryPerturbation);
                    }
                }

                const nextChange = map.stepRay(projectile, material, debugGraphics);
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
                console.info(`Commit material exit segment ${atTime}:${pos}`);
                projectile.commitSegmentTo(atTime, pos);

                const hitResult = map.castRay(projectile, debugGraphics);
                if (hitResult) {
                    const timeTo = projectile.calculateTimeTo(hitResult.pos);
                    const cumulativeTime = atTime + timeTo;

                    console.dir(
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
