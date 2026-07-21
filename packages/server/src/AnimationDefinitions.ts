import { IVec2, Orientation } from "@atbs/maths";
import { AnimationRecipe, DeathAnimation, SceneLeafNode } from "@atbs/shared-data";

export const DEATH_DURATION_MS = 2500;

/**
 * How long the client lingers on the dead unit (generic-dead sprite) in map mode
 * after the death spin completes, before restoring fire mode and resuming tracers.
 */
export const DEATH_HOLD_MS = 500;

/**
 * Data captured at the moment a unit dies, used to build the death spin animation
 * that is folded into the fire trace timeline.
 */
export interface UnitDeathRecord {
    unitId: string;
    orientation: Orientation;
    itemInUse: boolean;
    /** World-space center of the tile the unit died on. */
    worldPos: IVec2;
    timeMs: number;
    roundIndex: number;
    /** Map tile size in pixels; used as the recipe scale (mirrors the smoke convention). */
    scale: number;
}

/**
 * Builds the shared anim placeholder id used both for the tile render image and the
 * death animation's instanceId. These MUST match so the client renders the spin
 * through the tile placeholder only.
 */
export function unitDeathAnimId(unitId: string, roundIndex: number): string {
    return `anim-death-${unitId}-${roundIndex}`;
}

function normaliseDeathOrientation(orientation: Orientation): Orientation {
    if (orientation >= Orientation.NORTH && orientation <= Orientation.NORTH_WEST) {
        return orientation;
    }
    return Orientation.SOUTH;
}

export function buildUnitDeathAnimation(deathRecord: UnitDeathRecord): DeathAnimation {
    const D = normaliseDeathOrientation(deathRecord.orientation);
    const spriteBase = deathRecord.itemInUse ? "generic-carrying-" : "generic-";
    // Step clockwise through the 8 directional body sprites: at least two full
    // revolutions (16 steps) plus the clockwise delta from D to SOUTH so the final
    // displayed sprite is SOUTH. Verify: (D + stepCount) % 8 === SOUTH.
    const stepCount = 16 + ((Orientation.SOUTH - D + 8) % 8);
    // Frames ordered starting at the unit's current orientation. Frame resolution
    // modulo-wraps over 8, so frame value f shows orientation (D + f) % 8.
    const frames: SceneLeafNode[] = Array.from({ length: 8 }, (_unused, i) => [
        { imageId: `${spriteBase}${(D + i) % 8}` }
    ]);
    const instanceId = unitDeathAnimId(deathRecord.unitId, deathRecord.roundIndex);

    return {
        playAnimation: {
            instanceId,
            offset: 0,
            // worldPos intentionally omitted: the spin renders ONLY through the tile
            // `anim-` placeholder. Setting worldPos would double-draw it as a world overlay.
            recipe: {
                id: instanceId,
                stateDef: {
                    scale: deathRecord.scale,
                    opacity: 1,
                    rotation: 0,
                    // floor(stepCount * t) steps the frame 0..stepCount, showing each
                    // directional sprite in turn and ending on SOUTH.
                    frame: [
                        0,
                        [
                            {
                                type: "linear",
                                startOffset: 0,
                                duration: DEATH_DURATION_MS,
                                toValue: stepCount
                            }
                        ]
                    ],
                    renderable: {
                        default: { frames }
                    }
                }
            }
        },
        startTimeMs: deathRecord.timeMs,
        durationMs: DEATH_DURATION_MS,
        holdMs: DEATH_HOLD_MS
    };
}

// TODO: Move this into a VfxDefinitions file...
export const Smoke: AnimationRecipe = {
    id: "smoke.vfx",
    stateDef: {
        scale: [
            0,
            [
                { type: "linear", startOffset: 0, duration: 1000, toValue: 100 },
                { type: "ease-in", powerIn: 4, startOffset: 1000, duration: 10000, toValue: 0 }
            ]
        ],
        rotation: 0,
        opacity: [0, [{ type: "linear", startOffset: 0, duration: 500, toValue: 1 }]],
        renderable: {
            default: [{ imageId: "smoke15" }]
        }
    }
};
