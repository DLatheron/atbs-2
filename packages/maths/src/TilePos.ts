import { z } from "zod";
import { Clamp } from "./Maths.js";
// import { RecipeFactory } from "../../server/src/factory/RecipeFactory";
import { Orientation } from "./Orientation.js";
import { IVec2, Vec2, isIVec2 } from "./Vec2.js";

export const TilePosRecipe = z.tuple([z.number(), z.number()]);
export type TilePosRecipe = z.infer<typeof TilePosRecipe>;

export function isTilePosRecipe(arg: unknown): arg is TilePosRecipe {
    return arg !== null && arg !== undefined && Array.isArray(arg) && arg.length === 2;
}

export const ITilePos = z.object({
    col: z.number(),
    row: z.number()
});
export type ITilePos = z.infer<typeof ITilePos>;

export function isITilePos(arg: unknown): arg is ITilePos {
    return (
        arg !== null && arg !== undefined && typeof arg === "object" && "col" in arg && "row" in arg
    );
}

export function isTilePos(arg: unknown): arg is TilePos {
    return arg instanceof TilePos;
}

// function checkedRounded(value: number) {
//     return Math.abs(value - Math.floor(value)) === 0;
// }

export class TilePos implements ITilePos {
    public col: number; // x.
    public row: number; // y.

    constructor();
    constructor(col: number, row: number);
    constructor(vec: ITilePos);
    constructor(recipe: TilePosRecipe);
    constructor(...args: unknown[]) {
        if (isTilePosRecipe(args[0])) {
            this.col = args[0][0];
            this.row = args[0][1];
            return;
        }
        if (isITilePos(args[0])) {
            this.col = Math.floor(args[0].col);
            this.row = Math.floor(args[0].row);
            return;
        }

        this.col = typeof args[0] === "number" ? Math.floor(args[0]) : 0;
        this.row = typeof args[1] === "number" ? Math.floor(args[1]) : 0;
    }

    clone(): TilePos {
        return new TilePos(this.col, this.row);
    }

    add(addVec: IVec2 | ITilePos): TilePos {
        if (isIVec2(addVec)) {
            return new TilePos(this.col + addVec.x, this.row + addVec.y);
        } else {
            return new TilePos(this.col + addVec.col, this.row + addVec.row);
        }
    }

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

    length() {
        return Math.sqrt(this.sqrdLength());
    }

    manhattanLength() {
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

    // static TilePosFromRecipe(recipe: TilePosRecipe, factory: RecipeFactory): TilePos {
    //     return new TilePos(TilePos.TilePosRecipeToProps(recipe, factory));
    // }

    // static TilePosRecipeToProps(recipe: TilePosRecipe, _factory: RecipeFactory): ITilePos {
    //     return {
    //         col: recipe[0],
    //         row: recipe[1]
    //     };
    // }

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

    static StepZero() {
        return new TilePos(0, 0);
    }
    static StepUp() {
        return new TilePos(0, -1);
    }
    static StepUpRight() {
        return new TilePos(1, -1);
    }
    static StepRight() {
        return new TilePos(1, 0);
    }
    static StepDownRight() {
        return new TilePos(1, 1);
    }
    static StepDown() {
        return new TilePos(0, 1);
    }
    static StepDownLeft() {
        return new TilePos(-1, 1);
    }
    static StepLeft() {
        return new TilePos(-1, 0);
    }
    static StepUpLeft() {
        return new TilePos(-1, -1);
    }
}
