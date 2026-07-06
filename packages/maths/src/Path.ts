import { PathSegment } from "./DebugGraphics.js";
import { clamp } from "./Maths.js";
import { IVec2, Vec2 } from "./Vec2.js";

export function distancePointToSegment(point: IVec2, a: IVec2, b: IVec2): number {
    const ab = new Vec2(b).sub(a);
    const ap = new Vec2(point).sub(a);
    const abLenSq = ab.lengthSqrd;

    if (abLenSq === 0) {
        return ap.length;
    }

    const t = clamp(ap.dot(ab) / abLenSq, 0, 1);
    const closest = new Vec2(a).add(ab.scale(t));

    return new Vec2(point).sub(closest).length;
}

export function minDistanceFromPointToPathSegments(
    point: IVec2,
    segments: PathSegment[]
): number {
    if (segments.length === 0) {
        return Number.POSITIVE_INFINITY;
    }

    if (segments.length === 1) {
        return new Vec2(point).sub(segments[0].pos).length;
    }

    let minDist = Number.POSITIVE_INFINITY;

    for (let i = 0; i < segments.length - 1; i++) {
        const dist = distancePointToSegment(point, segments[i].pos, segments[i + 1].pos);
        minDist = Math.min(minDist, dist);
    }

    return minDist;
}
