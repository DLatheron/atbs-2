import type { Vec2 } from "@atbs/maths";
import { IRayCast } from "./IRayCast.js";

export class VisibilityRay implements IRayCast {
    private readonly _srcPos: Vec2;
    private readonly _dstPos: Vec2;
    
    private _life: number;
    private _intersection: Vec2 | undefined;

    private _rayValid: boolean;
    private _angleValid: boolean;


    constructor(srcPos: Vec2, dstPos: Vec2) {
        this._srcPos = srcPos;
        this._dstPos = dstPos;
        this._life = 1;
        this._intersection = undefined;
        this._rayValid = false;
        this._angleValid = false;
    }

    get srcPos(): Vec2 {
        return this._srcPos;
    }

    get dstPos(): Vec2 {
        return this._dstPos;
    }

    get intersection(): Vec2 | undefined {
        return this._intersection;
    }

    set intersection(value: Vec2 | undefined) {
        this._intersection = value;
    }

    get rayValid(): boolean {
        return this._rayValid;
    }

    set rayValid(value: boolean) {
        this._rayValid = value;
    }

    get angleValid(): boolean {
        return this._angleValid;
    }

    set angleValid(value: boolean) {
        this._angleValid = value;
    }

    get life(): number {
        return 1;
    }

    set life(value: number) {
        this._life = value;
    }

    get isRayAlive(): boolean {
        return this._life > 0;
    }
}
