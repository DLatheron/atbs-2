import { PathSegment } from "./DebugGraphics.js";
import { Aabb } from "./Aabb.js";
import { clamp, lerp } from "./Maths.js";
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

export function positionOnPathAtTime(path: PathSegment[], time: number): Vec2 {
    if (path.length === 0) {
        return new Vec2();
    }

    if (path.length === 1 || time <= path[0].time) {
        return new Vec2(path[0].pos);
    }

    const last = path[path.length - 1];
    if (time >= last.time) {
        return new Vec2(last.pos);
    }

    for (let index = 0; index < path.length - 1; index++) {
        const start = path[index];
        const end = path[index + 1];
        if (time > end.time) {
            continue;
        }

        const duration = end.time - start.time;
        const t = duration === 0 ? 1 : (time - start.time) / duration;
        return new Vec2({
            x: lerp(start.pos.x, end.pos.x, t),
            y: lerp(start.pos.y, end.pos.y, t)
        });
    }

    return new Vec2(last.pos);
}

export function minDistanceFromPointToPathSegments(point: IVec2, segments: PathSegment[]): number {
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

function lerpPathSegment(a: PathSegment, b: PathSegment, t: number): PathSegment {
    return {
        pos: {
            x: lerp(a.pos.x, b.pos.x, t),
            y: lerp(a.pos.y, b.pos.y, t)
        },
        time: lerp(a.time, b.time, t)
    };
}

/**
 * Parameter t in [0, 1] where the segment from an inside point `a` first leaves `bounds`.
 */
function aabbExitT(a: IVec2, b: IVec2, bounds: Aabb): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let t = 1;

    if (dx > 0) {
        t = Math.min(t, (bounds.max.x - a.x) / dx);
    } else if (dx < 0) {
        t = Math.min(t, (bounds.min.x - a.x) / dx);
    }

    if (dy > 0) {
        t = Math.min(t, (bounds.max.y - a.y) / dy);
    } else if (dy < 0) {
        t = Math.min(t, (bounds.min.y - a.y) / dy);
    }

    return clamp(t, 0, 1);
}

/**
 * Truncate a projectile path so it ends `trailLength` past leaving `worldBounds`.
 * Once the head and the full tail are outside the world, later off-map travel is dropped.
 */
export function clipPathAfterLeavingWorld(
    path: PathSegment[],
    worldBounds: Aabb,
    trailLength: number
): PathSegment[] {
    if (path.length < 2) {
        return path;
    }

    let exit: { index: number; point: PathSegment } | undefined;

    for (let index = 0; index < path.length - 1; index++) {
        const start = path[index];
        const end = path[index + 1];
        const startInside = worldBounds.isPointInside(start.pos);
        const endInside = worldBounds.isPointInside(end.pos);

        if (startInside && !endInside) {
            const t = aabbExitT(start.pos, end.pos, worldBounds);
            exit = { index, point: lerpPathSegment(start, end, t) };
            break;
        }
    }

    if (!exit) {
        return path;
    }

    let remaining = trailLength;
    const clipped = path.slice(0, exit.index + 1);

    if (exit.point.time > clipped[clipped.length - 1].time) {
        clipped.push(exit.point);
    }

    let from = exit.point;
    for (let index = exit.index + 1; index < path.length; index++) {
        const to = path[index];
        const segmentLength = new Vec2(to.pos).sub(from.pos).length;

        if (segmentLength >= remaining) {
            const t = segmentLength === 0 ? 1 : remaining / segmentLength;
            clipped.push(lerpPathSegment(from, to, t));
            return clipped;
        }

        remaining -= segmentLength;
        clipped.push(to);
        from = to;
    }

    return clipped;
}
