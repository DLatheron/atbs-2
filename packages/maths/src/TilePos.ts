import { z } from "zod";
import { Z } from "zod-class";
import { Clamp } from "./Maths.js";
import { Orientation } from "./Orientation.js";
import { IVec2, Vec2, isIVec2 } from "./Vec2.js";

export const ITilePos = z.object({
    col: z.int().nonnegative(),
    row: z.int().nonnegative()
});
export type ITilePos = z.infer<typeof ITilePos>;

export function isITilePos(arg: unknown): arg is ITilePos {
    return (
        arg !== null && arg !== undefined && typeof arg === "object" && "col" in arg && "row" in arg
    );
}

export class TilePos
    extends Z.class({
        col: z.number(), // x.
        row: z.number() // y.
    })
    implements ITilePos
{
    constructor(posObject: ITilePos);
    constructor(posArray: [number, number]);
    constructor(col: number, row: number);
    constructor(...args: unknown[]) {
        switch (args.length) {
            case 1:
                if (Array.isArray(args[0]) && args[0].length === 2) {
                    if (typeof args[0][0] === "number" && typeof args[0][1] === "number") {
                        super({ col: args[0][0], row: args[0][1] });
                    }
                } else {
                    if (isITilePos(args[0])) {
                        super(args[0]);
                    }
                }
                break;

            case 2:
                if (typeof args[0] === "number" && typeof args[1] === "number") {
                    super({ col: args[0], row: args[1] });
                }
                break;

            default:
                throw new Error(`Invalid arguments to TilePos: ${JSON.stringify(args)}`);
                break;
        }
    }

    clone(): TilePos {
        return new TilePos(this.col, this.row);
    }

    add(addVec: IVec2): TilePos;
    add(addVec: ITilePos): TilePos;
    add(addVec: IVec2 | ITilePos): TilePos {
        if (isIVec2(addVec)) {
            return new TilePos(this.col + addVec.x, this.row + addVec.y);
        } else {
            return new TilePos(this.col + addVec.col, this.row + addVec.row);
        }
    }

    subtract(subVec: IVec2): TilePos;
    subtract(subVec: ITilePos): TilePos;
    subtract(subVec: IVec2 | ITilePos): TilePos {
        if (isIVec2(subVec)) {
            return new TilePos(this.col - subVec.x, this.row - subVec.y);
        } else {
            return new TilePos(this.col - subVec.col, this.row - subVec.row);
        }
    }

    sqrdLength(): number {
        return this.col * this.col + this.row * this.row;
    }

    length(): number {
        return Math.sqrt(this.sqrdLength());
    }

    manhattanLength(): number {
        return Math.abs(this.col) + Math.abs(this.row);
    }

    scale(speed: number): Vec2 {
        return new Vec2(this.col * speed, this.row * speed);
    }

    divide(divisor: number): Vec2 {
        return new Vec2(this.col / divisor, this.row / divisor);
    }

    // NOTE: min threshold is inclusive, max threshold is exclusive!
    clamp(limits: { min: Vec2; max: Vec2 }): TilePos {
        return new TilePos(
            Clamp(this.col, limits.min.x, limits.max.x - 1),
            Clamp(this.row, limits.min.y, limits.max.y - 1)
        );
    }

    round(): TilePos {
        return new TilePos(Math.round(this.col), Math.round(this.row));
    }

    stepInDirection(direction: Orientation): TilePos {
        switch (direction) {
            case Orientation.NORTH:
                return this.add(new TilePos(0, -1));
            case Orientation.NORTH_EAST:
                return this.add(new TilePos(1, -1));
            case Orientation.EAST:
                return this.add(new TilePos(1, 0));
            case Orientation.SOUTH_EAST:
                return this.add(new TilePos(1, 1));
            case Orientation.SOUTH:
                return this.add(new TilePos(0, 1));
            case Orientation.SOUTH_WEST:
                return this.add(new TilePos(-1, 1));
            case Orientation.WEST:
                return this.add(new TilePos(-1, 0));
            case Orientation.NORTH_WEST:
                return this.add(new TilePos(-1, -1));
            case Orientation.CENTER:
                return this.clone();
        }
    }

    toString(): string {
        return `[${this.row}, ${this.col}]`;
    }

    static FromString(str: string) {
        const [row, col] = str
            .replace("[", "")
            .replace("]", "")
            .split(",")
            .map((v) => parseInt(v.trim(), 10));

        return new TilePos(col, row);
    }

    static IsEqual(a?: ITilePos, b?: ITilePos, threshold = 0.00001) {
        if (!a) {
            if (!b) {
                return true;
            }
            return false;
        } else {
            if (!b) {
                return false;
            }
            return Math.abs(a.col - b.col) <= threshold && Math.abs(a.row - b.row) <= threshold;
        }
    }

    static StepZero(): TilePos {
        return new TilePos(0, 0);
    }
    static StepUp(): TilePos {
        return new TilePos(0, -1);
    }
    static StepUpRight(): TilePos {
        return new TilePos(1, -1);
    }
    static StepRight(): TilePos {
        return new TilePos(1, 0);
    }
    static StepDownRight(): TilePos {
        return new TilePos(1, 1);
    }
    static StepDown(): TilePos {
        return new TilePos(0, 1);
    }
    static StepDownLeft(): TilePos {
        return new TilePos(-1, 1);
    }
    static StepLeft(): TilePos {
        return new TilePos(-1, 0);
    }
    static StepUpLeft(): TilePos {
        return new TilePos(-1, -1);
    }
}
