import type { Vec2 } from "@atbs/maths";
import type { VisualType } from "@atbs/shared-data";
import { IRayCast } from "./IRayCast.js";

/** Starting energy budget for a visual LOS ray. Tuned so densityMap eyeball:100 blocks in one pixel. */
export const VISUAL_RAY_LIFE = 100;

export class VisibilityRay implements IRayCast {
    private readonly _srcPos: Vec2;
    private readonly _dstPos: Vec2;
    private readonly _visualType: VisualType;

    private _life: number;
    private _intersection: Vec2 | undefined;

    private _rayValid: boolean;
    /** True when the in-view-cone status is still valid for the current orientation. */
    private _angleValid: boolean;
    /** Whether the LOS direction currently lies inside the viewer's view cone. */
    private _inViewCone: boolean;

    constructor(
        srcPos: Vec2,
        dstPos: Vec2,
        visualType: VisualType,
        life: number = VISUAL_RAY_LIFE
    ) {
        this._srcPos = srcPos;
        this._dstPos = dstPos;
        this._visualType = visualType;
        this._life = life;
        this._intersection = undefined;
        this._rayValid = false;
        this._angleValid = false;
        this._inViewCone = false;
    }

    get srcPos(): Vec2 {
        return this._srcPos;
    }

    get dstPos(): Vec2 {
        return this._dstPos;
    }

    get visualType(): VisualType {
        return this._visualType;
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

    get inViewCone(): boolean {
        return this._inViewCone;
    }

    set inViewCone(value: boolean) {
        this._inViewCone = value;
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
