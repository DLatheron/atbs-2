import { Aabb, Colour, DebugGraphic, DebugGraphicType, Vec2 } from "@atbs/maths";
import { Projectile } from "./Projectile.js";
import { Material } from "./Material.js";
import { XYAxis } from "./Ray.js";
import { roundToScale } from "../../../maths/src/Maths.js";
import z from "zod";

export interface Grid {
    aabb: Aabb; // Projectile position of the grid.
    gridScale: number;
    subGrid: boolean;
}

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

// Constants
const AABB_SAMPLE_SCALE = 0.999; // Scale factor for sub-grid AABB sampling

/**
 * Creates the major axis step calculator function based on the direction.
 */
function createMajorAxisStepCalculator(
    srcPos: Vec2,
    deltaChange: Vec2,
    xMajorAxis: boolean
): { xyAxis: XYAxis; calcMajorAxisStep: (majorAxisStep: number) => Vec2 } {
    if (xMajorAxis) {
        const dx = Math.sign(deltaChange.x);
        const dy = deltaChange.y / deltaChange.x;

        return {
            xyAxis: { major: "x", minor: "y" },
            calcMajorAxisStep: (majorAxisStep) => {
                const x = majorAxisStep * dx;
                const y = x * dy;
                return srcPos.add({ x, y });
            }
        };
    } else {
        const dx = deltaChange.x / deltaChange.y;
        const dy = Math.sign(deltaChange.y);

        return {
            xyAxis: { major: "y", minor: "x" },
            calcMajorAxisStep: (majorAxisStep) => {
                const y = majorAxisStep * dy;
                const x = y * dx;
                return srcPos.add({ x, y });
            }
        };
    }
}

/**
 * Samples a grid square and handles collision detection.
 * Returns the position if a collision should terminate the ray, otherwise void or "out-of-bounds".
 */
function sampleGridSquare(
    subSamplePos: Vec2,
    sampleType: SampleType,
    grid: Readonly<Grid>,
    stepPos: Vec2,
    sampleHandler: SampleHandler,
    handleCollision: CollisionHandler,
    touchedGrid: Set<string>
): Vec2 | "out-of-bounds" | void {
    // Check grid bounds
    if (!grid.aabb.isPointInside(subSamplePos)) {
        return "out-of-bounds";
    }

    // Generate grid key and check if already sampled
    const gridKey = `${Math.floor(subSamplePos.x)},${Math.floor(subSamplePos.y)}`;
    if (touchedGrid.has(gridKey)) {
        return;
    }

    // Sample the grid square
    const hitMaterial = sampleHandler(subSamplePos, sampleType);
    touchedGrid.add(gridKey);

    // Handle collision if material found
    if (hitMaterial && handleCollision(subSamplePos, hitMaterial)) {
        return stepPos;
    }
}

/**
 * Checks if a sub-grid square should be sampled based on ray intersection.
 * Returns result of sampling if applicable.
 */
function checkSubGridSquare(
    samplePos: Vec2,
    minorAxisValue: number,
    xyAxis: XYAxis,
    grid: Readonly<Grid>,
    stepPos: Vec2,
    srcPos: Vec2,
    dstPos: Vec2,
    sampleHandler: SampleHandler,
    handleCollision: CollisionHandler,
    touchedGrid: Set<string>,
    sampleType: SampleType
): Vec2 | "out-of-bounds" | void {
    const subSamplePos = new Vec2({
        ...samplePos,
        [xyAxis.minor]: minorAxisValue
    });

    // Create AABB for sub-grid square and check ray intersection
    const subSampleAabb = new Aabb(
        subSamplePos.x,
        subSamplePos.y,
        grid.gridScale * AABB_SAMPLE_SCALE,
        grid.gridScale * AABB_SAMPLE_SCALE
    );

    if (subSampleAabb.intersectRay(srcPos, dstPos)) {
        return sampleGridSquare(
            subSamplePos,
            sampleType,
            grid,
            stepPos,
            sampleHandler,
            handleCollision,
            touchedGrid
        );
    }
}

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

    // Determine initial ray position relative to grid
    if (grid.aabb.isPointInside(projectile.srcPos)) {
        srcPos = projectile.srcPos.sub(topLeft);
        dstPos = projectile.dstPos.sub(topLeft);
    } else {
        const intersectionPos = grid.aabb.intersectRay(projectile.srcPos, projectile.dstPos);
        if (!intersectionPos) {
            return false;
        }
        srcPos = intersectionPos.sub(topLeft);
        dstPos = projectile.dstPos.sub(topLeft);
    }

    // Set up axis-specific calculations
    const deltaChange = dstPos.sub(srcPos);
    const xMajorAxis = Math.abs(deltaChange.x) >= Math.abs(deltaChange.y);
    const { xyAxis, calcMajorAxisStep } = createMajorAxisStepCalculator(srcPos, deltaChange, xMajorAxis);

    // Track visited grid squares and iteration state
    const touchedGrid = new Set<string>();
    const lastStep = Math.abs(deltaChange[xyAxis.major]);

    let step = 0;
    let prevMinorAxisValue = 0;
    let stepPos = calcMajorAxisStep(step);

    // Main stepping loop
    for (;;) {
        // Calculate next position
        const nextStep = Math.min(step + grid.gridScale, lastStep);
        const nextStepPos = calcMajorAxisStep(nextStep);

        // Debug visualization
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

        // Round to grid scale
        const samplePos = new Vec2(
            roundToScale(stepPos.x, grid.gridScale),
            roundToScale(stepPos.y, grid.gridScale)
        );
        const currentMinorAxisValue = roundToScale(stepPos[xyAxis.minor], grid.gridScale);

        // Check for minor axis boundary crossing (sub-grid)
        if (subGrid) {
            const minorAxisCrossedPreviously = currentMinorAxisValue !== prevMinorAxisValue;

            if (minorAxisCrossedPreviously) {
                // Sample the grid square we just crossed into
                const hitResult = checkSubGridSquare(
                    samplePos,
                    roundToScale(prevMinorAxisValue, grid.gridScale),
                    xyAxis,
                    grid,
                    stepPos,
                    srcPos,
                    dstPos,
                    sampleHandler,
                    handleCollision,
                    touchedGrid,
                    "minor-past"
                );
                if (hitResult) {
                    return hitResult;
                }
            }
        }

        // Sample the current major grid square
        const hitResult = sampleGridSquare(
            samplePos,
            "major",
            grid,
            stepPos,
            sampleHandler,
            handleCollision,
            touchedGrid
        );
        if (hitResult) {
            return hitResult;
        }

        // Check for future minor axis boundary crossing
        if (subGrid && (currentMinorAxisValue === prevMinorAxisValue)) {
            const nextMinorAxisValue = roundToScale(nextStepPos[xyAxis.minor], grid.gridScale);
            if (currentMinorAxisValue !== nextMinorAxisValue) {
                // Sample the grid square we're about to cross into
                const hitResult = checkSubGridSquare(
                    samplePos,
                    nextMinorAxisValue,
                    xyAxis,
                    grid,
                    stepPos,
                    srcPos,
                    dstPos,
                    sampleHandler,
                    handleCollision,
                    touchedGrid,
                    "minor-future"
                );
                if (hitResult) {
                    return hitResult;
                }
            }
            prevMinorAxisValue = currentMinorAxisValue;
        } else if (subGrid) {
            prevMinorAxisValue = currentMinorAxisValue;
        }

        // Move to next step
        if (step === lastStep) {
            break;
        }

        step = nextStep;
        stepPos = nextStepPos;
    }

    return "out-of-bounds";
}
