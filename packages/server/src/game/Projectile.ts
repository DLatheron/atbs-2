import { Vec2 } from "@atbs/maths";
import { Game } from "./Game.js";
import { Item } from "./Item.js";
import { Unit } from "./Unit.js";
import { ProjectileRecipe } from "./ItemRecipe.js";
import { WorldMap } from "./WorldMap.js";
import { Tracer } from "@atbs/shared-data";

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

    private _impact?: {
        time: number;
        pos: Vec2;
    };

    constructor(props: ProjectileProps) {
        this._props = props;

        this._srcPos = new Vec2(props.srcPos);
        this._dstPos = this.srcPos.add(this.directionVector.scale(this.maxRange));
        this._velocity = props.projectileRecipe.visual.velocity;

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
}
