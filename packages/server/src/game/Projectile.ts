import { Colour, DebugGraphic, DebugGraphicType, Vec2 } from "@atbs/maths";
import { Game } from "./Game.js";
import { Item } from "./Item.js";
import { isUnit, Unit } from "./Unit.js";
import { ProjectileRecipe } from "./ItemRecipe.js";
import { WorldMap } from "./WorldMap.js";
import { MaterialDensityType, Tracer } from "@atbs/shared-data";
import { Material } from "./Material.js";
import { LowestFirst, Priority, PriorityQueue } from "@atbs/misc";
import { isFurniture } from "./Furniture.js";

interface CollisionEvent extends Priority {
    projectile: Projectile;
    pos: Vec2;
    material: Material;
}

export class CollisionEventQueue extends PriorityQueue<CollisionEvent> {
    constructor() {
        super(LowestFirst);
    }
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

export class Projectile {
    private readonly _props: ProjectileProps;

    private _srcPos: Vec2;
    private _dstPos: Vec2;
    private _velocity: number;
    private _penetration: number;

    private _impact?: {
        time: number;
        pos: Vec2;
    };

    constructor(props: ProjectileProps) {
        this._props = props;

        this._srcPos = new Vec2(props.srcPos);
        this._dstPos = this.srcPos.add(this.directionVector.scale(this.maxRange));
        this._velocity = props.projectileRecipe.visual.velocity;
        this._penetration = this.maxPenetration;

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
        return this._props.directionVector;
    }

    get maxRange(): number {
        return this._props.projectileRecipe.maxRange;
    }

    get velocity(): number {
        return this._velocity;
    }

    get penetration(): number {
        return this._penetration;
    }

    set penetration(value: number) {
        this._penetration = Math.min(value, 0);
    }

    get maxPenetration(): number {
        return this._props.projectileRecipe.penetration;
    }

    get impact():
        | {
              time: number;
              pos: Vec2;
          }
        | undefined {
        return this._impact;
    }

    set impact(value: Vec2) {
        this._impact = {
            time: 0,
            pos: value
        };
    }

    calculateTimeTo(pos: Vec2): number {
        const length = pos.sub(this.srcPos).length;
        return (length / this.velocity) * 1000;
    }

    getTracer(): Tracer {
        const endPos = this.impact?.pos ?? this.dstPos;
        const distanceTravelled = endPos.sub(this.srcPos).length;

        return {
            srcPos: this.srcPos,
            dstPos: this.impact?.pos ?? this.dstPos,
            flightTimeInMs: (distanceTravelled / this.velocity) * 1000,
            maxRange: distanceTravelled,
            visual: this._props.projectileRecipe.visual
        };
    }

    static ProcessProjectiles(
        projectiles: Projectile[],
        map: WorldMap,
        debugGraphics?: DebugGraphic[]
    ) {
        // Sort so that fastest projectiles are first.
        projectiles.sort((a, b) => b.velocity - a.velocity);
        console.dir({ projectiles });

        // debugGraphics?.push(
        //     {
        //         type: DebugGraphicType.enum.line,
        //         srcWorldPos: projectiles[0].srcPos,
        //         dstWorldPos: projectiles[0].dstPos,
        //         strokeColour: Colour.White,
        //         strokeThickness: 2
        //     },
        //     {
        //         type: DebugGraphicType.enum.point,
        //         worldPos: projectiles[0].srcPos,
        //         size: 6,
        //         colour: Colour.Red
        //     },
        //     {
        //         type: DebugGraphicType.enum.point,
        //         worldPos: projectiles[0].dstPos,
        //         size: 6,
        //         colour: Colour.Blue
        //     }
        // );

        const eventQueue = new CollisionEventQueue();

        // Determine the initial impact of every projectile.
        for (const projectile of projectiles) {
            const hitResult = map.castProjectile(projectile, debugGraphics);
            console.dir({ hitResult }, { depth: null });

            if (hitResult) {
                const timeTo = projectile.calculateTimeTo(hitResult.pos);
                console.dir(
                    `Projectile: ${projectile.index} took ${timeTo}ms to hit ${hitResult.pos}`
                );
                projectile.impact = hitResult.pos;

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

            let projectileStopped = false;
            console.info(`${atTime} event ${projectile.index} hit ${material.id} at ${pos}`);

            const density = material.getDensityForType(MaterialDensityType.enum.projectile);

            projectile.penetration -= density;
            if (projectile.penetration === 0) {
                projectileStopped = true;
            }
            console.info("Projectile stopped", projectileStopped);

            // Apply damage to material owner.
            if (isFurniture(owner)) {
                console.info("Collided with furniture!", owner.id);
            } else if (isUnit(owner)) {
                console.info("Collided with unit!", owner.id);
            }
        }

        // We have hit a material... we need to do the damage, and potentially continue the travel of that projectile
        // until something 'special' happens.

        // - apply damage to hit material
        //   - kill unit
        //   - destroy furniture
        // - potentially ricohet
        // - penetrate material
        // - cut hole in material
        // - dig crater in material
        // - update projectile to current state...

        // while ((event = eventQueue.pop())) {
        //     console.info(
        //         `${event.priority} event ${event.projectile.index} hit ${event.material.id} at ${event.pos}`
        //     );
        // }
    }
}
