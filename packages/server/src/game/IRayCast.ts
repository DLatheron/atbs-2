import { Vec2 } from "@atbs/maths";

export interface IRayCast {
    get srcPos(): Vec2;
    get dstPos(): Vec2;

    get life(): number;
    set life(value: number);

    get isRayAlive(): boolean;
}
