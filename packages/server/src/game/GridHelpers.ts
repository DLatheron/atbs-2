import { Aabb, Colour, DebugGraphic, DebugGraphicType, IVec2, Vec2 } from "@atbs/maths";
import { Projectile } from "./Projectile.js";
import { Material } from "./Material.js";
import { XYAxis } from "./Ray.js";
import { roundToScale } from "../../../maths/src/Maths.js";
import z from "zod";

const AABB_DIMENSION_SCALER = 0.999;

export interface Grid {
    aabb: Aabb; // Projectile position of the grid.
    gridScale: number;
    subGrid: boolean;
}

export interface GridHit {
    worldPos: Vec2;
    material: Material;
}

export type StepGridResult = GridHit | false | "out-of-bounds";

const sampleType = ["major", "minor-past", "minor-future"] as const;
export const SampleType = z.enum(sampleType);
export type SampleType = z.infer<typeof SampleType>;

/**
 * Returns a `Material` if the `gridRelativePos` contains a material, otherwise `undefined`.
 */
export type SampleHandler = (
    gridRelativePos: Vec2,
    nextMinorAxisValue: SampleType
) => Material | undefined;

/**
 * Returns `true` if the ray cast should stop, otherwise `false`.
 */
export type CollisionHandler = (gridRelativePos: Vec2, material: Material) => boolean;

/**
 *
 * @param projectile
 * @param grid
 * @param sampleHandler
 * @param handleCollision
 * @param debugGraphics
 * @returns Returns the world position of the intersection point and its material (if a collision occurs),
 * `false` if the projectile does not intersect with the grid at all, or `"out-of-bounds"` if the projectile
 * passes through the grid and out the other side.
 */
export function stepGrid(
    projectile: Readonly<Projectile>,
    grid: Readonly<Grid>,
    sampleHandler: SampleHandler,
    handleCollision: CollisionHandler,
    debugGraphics?: DebugGraphic[]
): StepGridResult {
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

    for (const sample of walkGrid(srcPos, dstPos, grid, debugGraphics)) {
        if (sample.outOfBounds) {
            return "out-of-bounds";
        }

        const hitMaterial = sampleHandler(sample.pos, sample.type);

        if (hitMaterial) {
            if (handleCollision(sample.pos, hitMaterial)) {
                return { worldPos: sample.pos, material: hitMaterial };
            }
        }
    }

    return false;
}

function preCalcMajorAxisStep(
    srcPos: Vec2,
    dstPos: Vec2
): {
    calcMajorAxisStep: (majorAxisStep: number) => Vec2;
    lastStep: number;
    xyAxis: XYAxis;
} {
    const deltaChange = dstPos.sub(srcPos);
    const xMajorAxis = Math.abs(deltaChange.x) >= Math.abs(deltaChange.y);
    const xyAxis: XYAxis = xMajorAxis ? { major: "x", minor: "y" } : { major: "y", minor: "x" };

    const deltaMajor = Math.sign(deltaChange[xyAxis.major]);
    const deltaMinor = deltaChange[xyAxis.minor] / deltaChange[xyAxis.major];

    const calcMajorAxisStep = (majorAxisStep: number): Vec2 => {
        const major = majorAxisStep * deltaMajor;
        const minor = major * deltaMinor;

        return srcPos.add({ [xyAxis.major]: major, [xyAxis.minor]: minor } as IVec2);
    };

    const lastStep = Math.abs(deltaChange[xyAxis.major]);

    return {
        calcMajorAxisStep,
        lastStep,
        xyAxis
    };
}

function hitsSubGrid(
    srcPos: Vec2,
    dstPos: Vec2,
    gridScale: number,
    subSamplePos: Vec2
): Vec2 | undefined {
    const subSamplePosAabb = new Aabb(
        subSamplePos.x,
        subSamplePos.y,
        gridScale * AABB_DIMENSION_SCALER,
        gridScale * AABB_DIMENSION_SCALER
    );

    return subSamplePosAabb.intersectRay(srcPos, dstPos);
}

function* walkGrid(
    srcPos: Vec2,
    dstPos: Vec2,
    grid: Grid,
    debugGraphics?: DebugGraphic[]
): Generator<
    | {
          outOfBounds: true;
      }
    | {
          outOfBounds?: false;
          pos: Vec2;
          type: "minor-past" | "major" | "minor-future";
      },
    undefined,
    undefined
> {
    // NOTE:
    // - There are probably going to be some weird edge-cases with this, for example when to stop the ray from sampling/
    //   considering things when we pass into out-of-bounds.
    const { subGrid, gridScale } = grid;
    const touchedGrid = new Set<number>();

    const roundToGrid = (value: number) => roundToScale(value, gridScale);
    const canVisitGrid = (pos: IVec2) => {
        const gridKey = (pos.y << 16) + pos.x;
        if (touchedGrid.has(gridKey)) {
            return false;
        } else {
            touchedGrid.add(gridKey);
            return true;
        }
    };

    const { calcMajorAxisStep, lastStep, xyAxis } = preCalcMajorAxisStep(srcPos, dstPos);

    let step = 0;
    let prevMinorAxisValue = 0;
    let stepPos = calcMajorAxisStep(step);

    for (;;) /* ever */ {
        const nextStep = Math.min(step + gridScale, lastStep);
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

        const samplePos = new Vec2(roundToGrid(stepPos.x), roundToGrid(stepPos.y));

        //
        // Check if in the previous sample we stepped across a grid square's minor axis
        // boundary and therefore need to consider a potentially missed grid square.
        //
        let minorAxis: number;
        let minorAxisCrossedPreviously: boolean;

        if (subGrid) {
            minorAxis = roundToGrid(stepPos[xyAxis.minor]);
            minorAxisCrossedPreviously = minorAxis !== prevMinorAxisValue;
            if (minorAxisCrossedPreviously) {
                const subSamplePos = new Vec2({
                    ...samplePos,
                    [xyAxis.minor]: roundToGrid(prevMinorAxisValue)
                });

                if (hitsSubGrid(srcPos, dstPos, gridScale, subSamplePos)) {
                    if (!grid.aabb.isPointInside(subSamplePos)) {
                        yield { outOfBounds: true };
                    }
                    if (canVisitGrid(subSamplePos)) {
                        yield {
                            pos: subSamplePos,
                            type: "minor-past"
                        };
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
        if (!grid.aabb.isPointInside(samplePos)) {
            yield { outOfBounds: true };
        }
        if (canVisitGrid(samplePos)) {
            yield {
                pos: samplePos,
                type: "major"
            };
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
                const nextMinorAxisValue = roundToGrid(nextStepPos[xyAxis.minor]);
                const minorAxisCrossedInFuture = minorAxis !== nextMinorAxisValue;
                if (minorAxisCrossedInFuture) {
                    const subSamplePos = new Vec2({
                        ...samplePos,
                        [xyAxis.minor]: roundToGrid(nextMinorAxisValue)
                    });

                    if (hitsSubGrid(srcPos, dstPos, gridScale, subSamplePos)) {
                        if (!grid.aabb.isPointInside(subSamplePos)) {
                            yield { outOfBounds: true };
                        }

                        if (canVisitGrid(subSamplePos)) {
                            yield {
                                pos: subSamplePos,
                                type: "minor-future"
                            };
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
}
