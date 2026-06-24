import { Aabb, Vec2 } from "@atbs/maths";
import { Projectile } from "./Projectile.js";
import { Material } from "./Material.js";
import { XYAxis } from "./Ray.js";
import { roundToScale } from "../../../maths/src/Maths.js";

export interface Grid {
    aabb: Aabb; // Projectile position of the grid.
    gridScale: number;
}

/**
 * Returns a `Material` if the `gridRelativePos` contains a material, otherwise `undefined`.
 */
export type SampleHandler = (gridRelativePos: Vec2) => Material | undefined;

/**
 * Returns `true` if the ray cast should stop, otherwise `false`.
 */
export type CollisionHandler = (gridRelativePos: Vec2, material: Material) => boolean;

/**
 *
 * @param projectile Projectile that is being tracked.
 * @param grid Details of the grid through which the projectile is passing.
 * @param sampleHandler A function called at each resolved position in the grid to determine if a collision has occurred.
 * Just because a collision occurs it doesn't necessarily mean that the ray cast terminates, that's determined by the
 * subsequent call to `handleCollision`.
 * @param handleCollision A function called after a collision occurs to determine if the projectile should stop its
 * travel.
 * @returns The position of the stopped projectile, or undefined if the project hasn't stopped yet.
 */
export function stepGrid(
    projectile: Readonly<Projectile>,
    grid: Readonly<Grid>,
    sampleHandler: SampleHandler,
    handleCollision: CollisionHandler
): Vec2 | undefined {
    const { topLeft } = grid.aabb;
    let srcPos: Vec2;
    let dstPos: Vec2;

    if (grid.aabb.isPointInside(projectile.srcPos)) {
        // Source point is inside the grid, make the destination point grid relative.
        srcPos = projectile.srcPos.sub(topLeft);
        dstPos = projectile.dstPos.sub(topLeft);
    } else {
        const intersectionPos = grid.aabb.intersectRay(projectile.srcPos, projectile.dstPos);
        if (!intersectionPos) {
            // Ray does not intersect with the grid.
            return;
        }
        // Source point intersects with the grid, make the destination point grid relative.
        srcPos = intersectionPos.sub(topLeft);
        dstPos = projectile.dstPos.sub(topLeft);
    }

    const deltaChange = dstPos.sub(srcPos);
    const xMajorAxis = Math.abs(deltaChange.x) >= Math.abs(deltaChange.y);
    let xyAxis: XYAxis;
    let calcMajorAxisStep: (majorAxisStep: number) => Vec2;
    if (xMajorAxis) {
        xyAxis = { major: "x", minor: "y" };

        const dx = Math.sign(deltaChange.x);
        const dy = deltaChange.y / deltaChange.x;

        calcMajorAxisStep = (majorAxisStep) => {
            const x = majorAxisStep * dx;
            const y = x * dy;

            return srcPos.add({ x, y });
        };
    } else {
        xyAxis = { major: "y", minor: "x" };

        const dx = deltaChange.x / deltaChange.y;
        const dy = Math.sign(deltaChange.y);

        calcMajorAxisStep = (majorAxisStep) => {
            const y = majorAxisStep * dy;
            const x = y * dx;

            return srcPos.add({ x, y });
        };
    }

    const totalSteps = Math.abs(deltaChange[xyAxis.major]);

    for (let step = 0; step < totalSteps; step += grid.gridScale) {
        const stepPos = calcMajorAxisStep(step);
        const samplePos = new Vec2(
            roundToScale(stepPos.x, grid.gridScale),
            roundToScale(stepPos.y, grid.gridScale)
        );

        if (!grid.aabb.isPointInside(samplePos)) {
            // We've stepped out the grid.
            break;
        }

        const hitMaterial = sampleHandler(samplePos);
        if (hitMaterial) {
            if (handleCollision(samplePos, hitMaterial)) {
                return stepPos;
            }
        }
    }

    return undefined;
}
