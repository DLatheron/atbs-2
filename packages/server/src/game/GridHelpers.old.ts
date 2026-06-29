import { DebugGraphic, Vec2, DebugGraphicType, Colour, Aabb } from "@atbs/maths";
import { roundToScale } from "../../../maths/src/Maths.js";
import { Grid, SampleHandler, CollisionHandler, SampleType } from "./GridHelpers.js";
import { Projectile } from "./Projectile.js";
import { XYAxis } from "./Ray.js";

const AABB_DIMENSION_SCALER = 0.999;

/**
 *
 * @param projectile Projectile that is being tracked.
 * @param grid Details of the grid through which the projectile is passing.
 * @param sampleHandler A function called at each resolved position in the grid to determine if a collision has occurred.
 * Just because a collision occurs it doesn't necessarily mean that the ray cast terminates, that's determined by the
 * subsequent call to `handleCollision`.
 * @param handleCollision A function called after a collision occurs to determine if the projectile should stop its
 * travel.
 * @returns The position of the stopped projectile, false if the ray does not intersect with the grid at all or
 * "out-of-bounds" if the projectile has passed out the other side of the grid.
 */
export function stepGrid(
    projectile: Readonly<Projectile>,
    grid: Readonly<Grid>,
    sampleHandler: SampleHandler,
    handleCollision: CollisionHandler,
    debugGraphics?: DebugGraphic[]
): Vec2 | false | "out-of-bounds" {
    const { subGrid } = grid;
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
            return false;
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

    // Records which grid squares we have already collided against - to avoid repetitions.
    const touchedGrid = new Set<number>();
    const lastStep = Math.abs(deltaChange[xyAxis.major]);

    let step = 0;
    let prevMinorAxisValue = 0;
    let stepPos = calcMajorAxisStep(step);

    function sampleGrid(subSamplePos: Vec2, sampleType: SampleType): Vec2 | "out-of-bounds" | void {
        if (!grid.aabb.isPointInside(subSamplePos)) {
            return "out-of-bounds";
        }

        const gridKey = (subSamplePos.y << 16) + subSamplePos.x;
        if (touchedGrid.has(gridKey)) {
            return;
        }

        const hitMaterial = sampleHandler(subSamplePos, sampleType);
        touchedGrid.add(gridKey);

        if (hitMaterial) {
            if (handleCollision(subSamplePos, hitMaterial)) {
                return stepPos;
            }
        }
    }

    for (;;) /* ever */ {
        // Calculate the next position, nextStepPos becomes undefined if we are done.
        const nextStep = Math.min(step + grid.gridScale, lastStep);
        const nextStepPos = calcMajorAxisStep(nextStep);

        debugGraphics?.push(
            {
                type: DebugGraphicType.enum.point,
                worldPos: stepPos,
                size: 6,
                colour: Colour.Magenta
            },
            {
                type: DebugGraphicType.enum.text,
                worldPos: stepPos,
                text: `${step}`,
                colour: Colour.White
            }
        );

        const samplePos = new Vec2(
            roundToScale(stepPos.x, grid.gridScale),
            roundToScale(stepPos.y, grid.gridScale)
        );

        //
        // Check if in the previous sample we stepped across a grid square's minor axis
        // boundary and therefore need to consider a potentially missed grid square.
        //
        let minorAxis: number;
        let minorAxisCrossedPreviously: boolean;

        if (subGrid) {
            minorAxis = roundToScale(stepPos[xyAxis.minor], grid.gridScale);
            minorAxisCrossedPreviously = minorAxis !== prevMinorAxisValue;
            if (minorAxisCrossedPreviously) {
                const subSamplePos = new Vec2({
                    ...samplePos,
                    [xyAxis.minor]: roundToScale(prevMinorAxisValue, grid.gridScale)
                });
                const subSamplePosAabb = new Aabb(
                    subSamplePos.x,
                    subSamplePos.y,
                    grid.gridScale * AABB_DIMENSION_SCALER,
                    grid.gridScale * AABB_DIMENSION_SCALER
                );
                const hitsSubSample = subSamplePosAabb.intersectRay(srcPos, dstPos);

                if (hitsSubSample) {
                    const hitResult = sampleGrid(subSamplePos, "minor-past");
                    if (hitResult) {
                        return hitResult;
                    }
                }
            }
        } else {
            minorAxis = 0;
            minorAxisCrossedPreviously = false;
        }

        //
        // Check the current grid square.
        //
        const hitResult = sampleGrid(samplePos, "major");
        if (hitResult) {
            return hitResult;
        }

        //
        // Check if in the next step we are going to step across a grid square's minor axis
        // boundary and therefore need to consider a potentially collision BEFORE we visit the
        // next grid square along the major axis.
        //
        // NOTE: We cannot cross the minor axis more quickly than the major axis, therefore we
        // can only cross it before OR after, NEVER both. So if we've already cross it last time
        // we can't cross it again so soon.
        if (subGrid) {
            if (!minorAxisCrossedPreviously) {
                const nextMinorAxisValue = roundToScale(nextStepPos[xyAxis.minor], grid.gridScale);
                const minorAxisCrossedInFuture = minorAxis !== nextMinorAxisValue;
                if (minorAxisCrossedInFuture) {
                    const subSamplePos = new Vec2({
                        ...samplePos,
                        [xyAxis.minor]: roundToScale(nextMinorAxisValue, grid.gridScale)
                    });
                    const subSamplePosAabb = new Aabb(
                        subSamplePos.x,
                        subSamplePos.y,
                        grid.gridScale * AABB_DIMENSION_SCALER,
                        grid.gridScale * AABB_DIMENSION_SCALER
                    );
                    const hitsSubSample = subSamplePosAabb.intersectRay(srcPos, dstPos);

                    if (hitsSubSample) {
                        const hitResult = sampleGrid(subSamplePos, "minor-future");
                        if (hitResult) {
                            return hitResult;
                        }
                    }
                }
            }

            prevMinorAxisValue = minorAxis;
        }

        if (step === lastStep) {
            break;
        }

        step = nextStep;
        stepPos = nextStepPos;
    }

    return "out-of-bounds";
}
