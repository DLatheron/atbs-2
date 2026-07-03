import { z } from "zod";
import { Z } from "zod-class";
import { Clamp, Lerp } from "./Maths.js";
import { Orientation } from "./Orientation.js";
import { TilePos } from "./TilePos.js";

export const IVec2 = z.object({
    x: z.number(),
    y: z.number()
});
export type IVec2 = z.infer<typeof IVec2>;

export function isIVec2(arg: unknown): arg is IVec2 {
    return IVec2.safeParse(arg).success;
}

export class Vec2
    extends Z.class({
        x: z.number(),
        y: z.number()
    })
    implements IVec2
{
    constructor();
    constructor(vecObject: IVec2);
    constructor(vecArray: [number, number]);
    constructor(x: number, y: number);
    constructor(...args: unknown[]) {
        switch (args.length) {
            case 0:
                super({ x: 0, y: 0 });
                break;

            case 1:
                if (Array.isArray(args[0]) && args[0].length === 2) {
                    if (typeof args[0][0] === "number" && typeof args[0][1] === "number") {
                        super({ x: args[0][0], y: args[0][1] });
                    }
                } else {
                    if (isIVec2(args[0])) {
                        super(args[0]);
                    }
                }
                break;

            case 2:
                if (typeof args[0] === "number" && typeof args[1] === "number") {
                    super({ x: args[0], y: args[1] });
                }
                break;

            default:
                throw new Error(`Invalid arguments to Vec2: ${JSON.stringify(args)}`);
                break;
        }
    }

    normalise(): Vec2 {
        return this.divide(this.length);
    }

    safeNormalise(): Vec2 {
        const { length } = this;
        if (length === 0.0) {
            return Vec2.Zero();
        }
        return this.divide(length);
    }

    get length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    get lengthSqrd(): number {
        return this.x * this.x + this.y * this.y;
    }

    clone(): Vec2 {
        return new Vec2(this.x, this.y);
    }

    add(addVec: IVec2): Vec2 {
        return new Vec2(this.x + addVec.x, this.y + addVec.y);
    }

    sub(addVec: IVec2): Vec2 {
        return new Vec2(this.x - addVec.x, this.y - addVec.y);
    }

    scale(speed: number): Vec2 {
        return new Vec2(this.x * speed, this.y * speed);
    }

    divide(length: number): Vec2 {
        if (length === 0) {
            throw new Error("Divide by zero");
        }
        return new Vec2(this.x / length, this.y / length);
    }

    negate(): Vec2 {
        return new Vec2(-this.x, -this.y);
    }

    isNonZero(): boolean {
        return this.x !== 0 || this.y !== 0;
    }

    rotate(angleInRadians: number): Vec2 {
        const ca = Math.cos(angleInRadians);
        const sa = Math.sin(angleInRadians);

        return new Vec2(ca * this.x - sa * this.y, sa * this.x + ca * this.y);
    }

    dot(otherVec: IVec2): number {
        return this.x * otherVec.x + this.y * otherVec.y;
    }

    isEqual(otherVec: IVec2, threshold = 0.00001): boolean {
        return (
            Math.abs(this.x - otherVec.x) <= threshold && Math.abs(this.y - otherVec.y) <= threshold
        );
    }

    ceil(): Vec2 {
        return new Vec2(Math.ceil(this.x), Math.ceil(this.y));
    }

    round(): Vec2 {
        return new Vec2(Math.round(this.x), Math.round(this.y));
    }

    floor(): Vec2 {
        return new Vec2(Math.floor(this.x), Math.floor(this.y));
    }

    toTilePos(tileSize: number): TilePos {
        return new TilePos({
            col: Math.floor(this.x * tileSize),
            row: Math.floor(this.y * tileSize)
        });
    }

    reflect(n: Vec2): Vec2 {
        const dot = this.dot(n) * 2;

        return this.sub(n.scale(dot));
    }

    /**
     * Clamps a vector between the specified limits.
     * @param limits Min/max limits.
     * @returns A new vector with its limits clamped so that min >= value <= max - threshold
     */
    clamp(limits: { min: IVec2; max: IVec2 }, upperThreshold = 1): Vec2 {
        return new Vec2(
            Clamp(this.x, limits.min.x, limits.max.x - upperThreshold),
            Clamp(this.y, limits.min.y, limits.max.y - upperThreshold)
        );
    }

    stepInDirection(direction: Orientation): Vec2 {
        switch (direction) {
            case Orientation.NORTH:
                return this.add(new Vec2(0, -1));
            case Orientation.NORTH_EAST:
                return this.add(new Vec2(1, -1));
            case Orientation.EAST:
                return this.add(new Vec2(1, 0));
            case Orientation.SOUTH_EAST:
                return this.add(new Vec2(1, 1));
            case Orientation.SOUTH:
                return this.add(new Vec2(0, 1));
            case Orientation.SOUTH_WEST:
                return this.add(new Vec2(-1, 1));
            case Orientation.WEST:
                return this.add(new Vec2(-1, 0));
            case Orientation.NORTH_WEST:
                return this.add(new Vec2(-1, -1));
            case Orientation.CENTER:
                return this.clone();
        }
    }

    static StepInDirection(direction: Orientation): Vec2 {
        switch (direction) {
            case Orientation.NORTH:
                return Vec2.StepUp();
            case Orientation.NORTH_EAST:
                return Vec2.StepUpRight();
            case Orientation.EAST:
                return Vec2.StepRight();
            case Orientation.SOUTH_EAST:
                return Vec2.StepDownRight();
            case Orientation.SOUTH:
                return Vec2.StepDown();
            case Orientation.SOUTH_WEST:
                return Vec2.StepDownLeft();
            case Orientation.WEST:
                return Vec2.StepLeft();
            case Orientation.NORTH_WEST:
                return Vec2.StepUpLeft();
            case Orientation.CENTER:
                return Vec2.Zero();
        }
    }

    toString(): string {
        return `(${this.x}, ${this.y})`;
    }

    static IsEqual(a?: IVec2, b?: IVec2, threshold = 0.00001) {
        if (!a) {
            if (!b) {
                return true;
            }
            return false;
        } else {
            if (!b) {
                return false;
            }
            return Math.abs(a.x - b.x) <= threshold && Math.abs(a.y - b.y) <= threshold;
        }
    }

    static Interpolate(a: IVec2, b: IVec2, t: number, interpolateFn = Lerp): Vec2 {
        t = Clamp(t, 0, 1);

        return new Vec2(interpolateFn(a.x, b.x, t), interpolateFn(a.y, b.y, t));
    }

    static Slerp(a: Vec2, b: Vec2, t: number): Vec2 {
        if (a.isEqual(b)) {
            return a;
        }

        const dot = Clamp(a.dot(b), -1.0, 1.0);

        const theta = Math.acos(dot) * t;
        const relativeVec = b.sub(a.scale(dot)).normalise();

        return a.scale(Math.cos(theta)).add(relativeVec.scale(Math.sin(theta)));
    }

    static AngleBetweenInRadians(nrmA: IVec2, nrmB: IVec2): number {
        return Math.atan2(nrmA.x * nrmB.y - nrmA.y * nrmB.x, nrmA.x * nrmB.x + nrmA.y * nrmB.y);
    }

    static Zero(): Vec2 {
        return new Vec2(0, 0);
    }
    static Up(): Vec2 {
        return new Vec2(0, -1);
    }
    static UpRight(): Vec2 {
        return new Vec2(1, -1).normalise();
    }
    static Right(): Vec2 {
        return new Vec2(1, 0);
    }
    static DownRight(): Vec2 {
        return new Vec2(1, 1).normalise();
    }
    static Down(): Vec2 {
        return new Vec2(0, 1);
    }
    static DownLeft(): Vec2 {
        return new Vec2(-1, 1).normalise();
    }
    static Left(): Vec2 {
        return new Vec2(-1, 0);
    }
    static UpLeft(): Vec2 {
        return new Vec2(-1, -1).normalise();
    }

    static StepZero(): Vec2 {
        return new Vec2(0, 0);
    }
    static StepUp(): Vec2 {
        return new Vec2(0, -1);
    }
    static StepUpRight(): Vec2 {
        return new Vec2(1, -1);
    }
    static StepRight(): Vec2 {
        return new Vec2(1, 0);
    }
    static StepDownRight(): Vec2 {
        return new Vec2(1, 1);
    }
    static StepDown(): Vec2 {
        return new Vec2(0, 1);
    }
    static StepDownLeft(): Vec2 {
        return new Vec2(-1, 1);
    }
    static StepLeft(): Vec2 {
        return new Vec2(-1, 0);
    }
    static StepUpLeft(): Vec2 {
        return new Vec2(-1, -1);
    }

    static OrientationToDirectionVector(orientation: Orientation): Vec2 {
        switch (orientation) {
            case Orientation.NORTH:
                return Vec2.Up();
            case Orientation.NORTH_EAST:
                return Vec2.UpRight();
            case Orientation.EAST:
                return Vec2.Right();
            case Orientation.SOUTH_EAST:
                return Vec2.DownRight();
            case Orientation.SOUTH:
                return Vec2.Down();
            case Orientation.SOUTH_WEST:
                return Vec2.DownLeft();
            case Orientation.WEST:
                return Vec2.Left();
            case Orientation.NORTH_WEST:
                return Vec2.UpLeft();
            case Orientation.CENTER:
                throw new Error("Cannot convert CENTER orientation to vector");
        }
    }
}
