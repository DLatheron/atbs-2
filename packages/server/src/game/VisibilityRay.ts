import type { Vec2 } from "@atbs/maths";

export class VisibilityRay {
    private readonly _srcPos: Vec2;
    private readonly _dstPos: Vec2;

    private _intersection: Vec2 | undefined;

    private _invalidRay: boolean;
    private _invalidAngle: boolean;

    constructor(srcPos: Vec2, dstPos: Vec2) {
        this._srcPos = srcPos;
        this._dstPos = dstPos;
        this._intersection = undefined;
        this._invalidRay = false;
        this._invalidAngle = false;
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

    get isRayInvalid(): boolean {
        return this._invalidRay;
    }

    get isAngleInvalid(): boolean {
        return this._invalidAngle;
    }

    setValid(): void {
        this._invalidRay = false;
        this._invalidAngle = false;
    }
}
