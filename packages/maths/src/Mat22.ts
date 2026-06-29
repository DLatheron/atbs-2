import { Z } from "zod-class";
import { isIVec2, IVec2, Vec2 } from "./Vec2.js";
import z from "zod";

export interface IMat22 {
    0: IVec2;
    1: IVec2;
}

export function isIMat22(arg: unknown): arg is IMat22 {
    return arg !== null && arg !== undefined && typeof arg === "object" && "0" in arg && "1" in arg;
}

const TupleMat22 = z.tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])]);
type TupleMat22 = z.infer<typeof TupleMat22>;

export function isTupleMat22(arg: unknown): arg is TupleMat22 {
    return TupleMat22.safeParse(arg).success;
}

export class Mat22
    extends Z.class({
        0: IVec2,
        1: IVec2
    })
    implements IMat22
{
    constructor();
    constructor(vecArray: TupleMat22);
    // TODO: Single dimension array?
    constructor(m00: number, m01: number, m10: number, m11: number);
    constructor(v0: IVec2, v1: IVec2);
    constructor(...args: unknown[]) {
        switch (args.length) {
            case 0:
                super({ 0: new Vec2(1, 0), 1: new Vec2(0, 1) });
                break;

            case 1:
                if (isTupleMat22(args[0])) {
                    super({ 0: new Vec2(args[0][0]), 1: new Vec2(args[0][1]) });
                }
                break;

            case 2:
                if (isIVec2(args[0]) && isIVec2(args[1])) {
                    super({ 0: args[0], 1: args[1] });
                }
                break;

            case 4:
                if (
                    typeof args[0] === "number" &&
                    typeof args[1] === "number" &&
                    typeof args[2] === "number" &&
                    typeof args[3] === "number"
                ) {
                    super({ 0: new Vec2(args[0], args[1]), 1: new Vec2(args[2], args[3]) });
                }
                break;

            default:
                throw new Error(`Invalid arguments to Mat22: ${JSON.stringify(args)}`);
                break;
        }
    }

    multiply(vec: Vec2): Vec2 {
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
