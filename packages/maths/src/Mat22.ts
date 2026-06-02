import { z } from "zod";
import { IVec2, Vec2, isIVec2 } from "./Vec2.js";

export const Mat22Recipe = z.object({
    0: IVec2,
    1: IVec2
});
export type Mat22Recipe = z.infer<typeof Mat22Recipe>;

export function isMat22Recipe(arg: unknown): arg is Mat22Recipe {
    return arg !== null && arg !== undefined && typeof arg === "object" && "0" in arg && "1" in arg;
}

export const IMat22 = z.object({
    0: IVec2,
    1: IVec2
});
export type IMat22 = z.infer<typeof IMat22>;

export function isIMat22(arg: unknown): arg is IMat22 {
    return arg !== null && arg !== undefined && typeof arg === "object" && "0" in arg && "1" in arg;
}

export class Mat22 implements IMat22 {
    public 0: IVec2;
    public 1: IVec2;

    constructor();
    constructor(v0: IVec2, v1: IVec2);
    constructor(m00: number, m01: number, m10: number, m11: number);
    constructor(...args: unknown[]) {
        if (args.length === 2 && isIVec2(args[0]) && isIVec2(args[1])) {
            this[0] = args[0];
            this[1] = args[1];
            return;
        }

        this[0] = {
            x: typeof args[0] === "number" ? args[0] : 1,
            y: typeof args[1] === "number" ? args[1] : 0
        };
        this[1] = {
            x: typeof args[2] === "number" ? args[2] : 0,
            y: typeof args[3] === "number" ? args[3] : 1
        };
    }

    multiply(vec: IVec2) {
        return new Vec2(
            this[0].x * vec.x + this[1].x * vec.y,
            this[0].y * vec.x + this[1].y * vec.y
        );
    }

    static MakeIdentity() {
        return new Mat22(1, 0, 0, 1);
    }

    static MakeRotation(angleInRadians: number) {
        const c = Math.cos(angleInRadians);
        const s = Math.sin(angleInRadians);
        return new Mat22(c, -s, s, c);
    }
}
