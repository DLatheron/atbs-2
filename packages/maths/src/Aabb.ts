import { IVec2, Vec2 } from "./Vec2.js";
import { checkIntersection } from "line-intersect";

export function isAabb(arg: unknown): arg is Aabb {
    return arg instanceof Aabb;
}

export function sign(value: number): number {
    return value < 0 ? -1 : 1;
}

export class Aabb {
    private readonly _min: Vec2;
    private readonly _max: Vec2;

    /**
     * Can be initialised with either:
     *   min, max
     * or
     *   x, y, width, height
     */
    constructor(other: Aabb);
    constructor(min: Vec2, max: IVec2);
    constructor(x: number, y: number, width: number, height: number);
    constructor(...args: unknown[]) {
        if (args.length === 1 && isAabb(args[0])) {
            const otherAabb = args[0];

            this._min = new Vec2(otherAabb.min.x, otherAabb.min.y);
            this._max = new Vec2(otherAabb.max.x, otherAabb.max.y);
        } else if (args.length === 2) {
            const otherMin = args[0] as IVec2;
            const otherMax = args[1] as IVec2;

            this._min = new Vec2(otherMin.x, otherMin.y);
            this._max = new Vec2(otherMax.x, otherMax.y);
        } else if (args.length === 4) {
            const x = args[0] as number;
            const y = args[1] as number;

            const width = args[2] as number;
            const height = args[3] as number;
            this._min = new Vec2(x, y);
            this._max = new Vec2(x + width, y + height);
        } else {
            throw new Error("Invalid definition for Aabb");
        }
    }

    get min() {
        return this._min;
    }
    get max() {
        return this._max;
    }

    get x() {
        return this.min.x;
    }
    get y() {
        return this.min.y;
    }
    get width() {
        return this.max.x - this.min.x;
    }
    get height() {
        return this.max.y - this.min.y;
    }
    get halfWidth() {
        return this.width / 2;
    }
    get halfHeight() {
        return this.height / 2;
    }

    get topLeft() {
        return new Vec2(this.min.x, this.min.y);
    }
    get topCenter() {
        return new Vec2(this.min.x + this.width / 2, this.min.y);
    }
    get topRight() {
        return new Vec2(this.max.x, this.min.y);
    }

    get middleLeft() {
        return new Vec2(this.min.x, this.min.y + this.height / 2);
    }
    get middleCenter() {
        return new Vec2(this.min.x + this.width / 2, this.min.y + this.height / 2);
    }
    get middleRight() {
        return new Vec2(this.max.x, this.min.y + this.height / 2);
    }

    get bottomLeft() {
        return new Vec2(this.min.x, this.max.y);
    }
    get bottomCenter() {
        return new Vec2(this.min.x + this.width / 2, this.max.y);
    }
    get bottomRight() {
        return new Vec2(this.max.x, this.max.y);
    }

    isPointInside(pos: IVec2) {
        return (
            pos.x >= this.min.x && pos.x < this.max.x && pos.y >= this.min.y && pos.y < this.max.y
        );
    }

    intersectionWith(otherAabb: Aabb) {
        const newAabb = new Aabb(this);

        if (newAabb.min.x < otherAabb.min.x) {
            newAabb.min.x = otherAabb.min.x;
        }
        if (newAabb.max.x > otherAabb.max.x) {
            newAabb.max.x = otherAabb.max.x;
        }

        if (newAabb.min.y < otherAabb.min.y) {
            newAabb.min.y = otherAabb.min.y;
        }
        if (newAabb.max.y > otherAabb.max.y) {
            newAabb.max.y = otherAabb.max.y;
        }

        return newAabb;
    }

    // intersectRay(
    //     pos: Vec2,
    //     delta: Vec2,
    //     paddingX: number = 0,
    //     paddingY: number = 0
    // ) {
    //     // const scaleX = 1.0 / delta.x;
    //     // const scaleY = 1.0 / delta.y;
    //     // const signX = sign(scaleX);
    //     // const signY = sign(scaleY);
    //     // const nearTimeX = (this.middleCenter.x - signX * (this.halfWidth + paddingX) - pos.x) * scaleX;
    //     // const nearTimeY = (this.middleCenter.y - signY * (this.halfHeight + paddingY) - pos.y) * scaleY;
    //     // const farTimeX = (this.middleCenter.x + signX * (this.halfWidth + paddingX) - pos.x) * scaleX;
    //     // const farTimeY = (this.middleCenter.y + signY * (this.halfHeight + paddingY) - pos.y) * scaleY;

    //     // if (nearTimeX > farTimeY || nearTimeY > farTimeX) {
    //     //     return undefined;
    //     // }

    //     // const nearTime = nearTimeX > nearTimeY ? nearTimeX : nearTimeY;
    //     // const farTime = farTimeX < farTimeY ? farTimeX : farTimeY;

    //     // if (nearTime >= 1 || farTime <= 0) {
    //     //     return undefined;
    //     // }

    //     // const time = nearTime;
    //     // // const time = Clamp(nearTime, 0, 1);

    //     // return {
    //     //     time,
    //     //     normal: (nearTimeX > nearTimeY) ? new Vec2(-signX, 0) : new Vec2(0, -signY),
    //     //     delta: new Vec2((1.0 - time) * -delta.x, (1.0 - time) * -delta.y),
    //     //     pos: new Vec2(pos.x + delta.x * time, pos.y + delta.y * time)
    //     // }

    //     let tmin = -Number.NEGATIVE_INFINITY, tmax = Number.POSITIVE_INFINITY;

    //     if (delta.x != 0.0) {
    //         const tx1 = (this.min.x - pos.x) / delta.x;
    //         const tx2 = (this.max.x - pos.x) / delta.x;

    //         tmin = Math.max(tmin, Math.min(tx1, tx2));
    //         tmax = Math.min(tmax, Math.max(tx1, tx2));
    //     }

    //     if (delta.y != 0.0) {
    //         const ty1 = (this.min.y - pos.y) / delta.y;
    //         const ty2 = (this.max.y - pos.y) / delta.y;

    //         tmin = Math.max(tmin, Math.min(ty1, ty2));
    //         tmax = Math.min(tmax, Math.max(ty1, ty2));
    //     }

    //     return tmax >= 0 && tmax >= tmin;
    // }

    intersectRay(pos: Vec2, delta: Vec2): Vec2 | undefined {
        // Lifted directly from:
        //   https://dirask.com/posts/JavaScript-calculate-intersection-point-of-two-lines-for-given-4-points-VjvnAj
        // No significant changes made.
        // function calculateIntersection(p1: IVec2, p2: IVec2, p3: IVec2, p4: IVec2) {
        //     var c2x = p3.x - p4.x; // (x3 - x4)
        //     var c3x = p1.x - p2.x; // (x1 - x2)
        //     var c2y = p3.y - p4.y; // (y3 - y4)
        //     var c3y = p1.y - p2.y; // (y1 - y2)

        //       // down part of intersection point formula
        //     var d  = c3x * c2y - c3y * c2x;

        //     if (Math.abs(d) <= 0.0001) {
        //         return;
        //     }

        //     // upper part of intersection point formula
        //     var u1 = p1.x * p2.y - p1.y * p2.x; // (x1 * y2 - y1 * x2)
        //     var u4 = p3.x * p4.y - p3.y * p4.x; // (x3 * y4 - y3 * x4)

        //     // intersection point formula

        //     var px = (u1 * c2x - c3x * u4) / d;
        //     var py = (u1 * c2y - c3y * u4) / d;

        //     return new Vec2(px, py);
        // }
        function calculateIntersection(p1: IVec2, p2: IVec2, p3: IVec2, p4: IVec2) {
            const result = checkIntersection(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y);
            if (result.type === "intersecting") {
                return new Vec2(result.point.x, result.point.y);
            }
        }

        const { topLeft, topRight, bottomLeft, bottomRight } = this;

        let intersection: Vec2 | undefined;

        intersection = calculateIntersection(pos, delta, topLeft, topRight);
        if (intersection) {
            return intersection;
        }
        intersection = calculateIntersection(pos, delta, topRight, bottomRight);
        if (intersection) {
            return intersection;
        }
        intersection = calculateIntersection(pos, delta, bottomRight, bottomLeft);
        if (intersection) {
            return intersection;
        }
        intersection = calculateIntersection(pos, delta, bottomLeft, topLeft);
        if (intersection) {
            return intersection;
        }
    }

    static IsEqual(a?: Aabb, b?: Aabb, threshold = 0.00001) {
        return Vec2.IsEqual(a?.min, b?.min, threshold) && Vec2.IsEqual(a?.max, b?.max, threshold);
    }
}
