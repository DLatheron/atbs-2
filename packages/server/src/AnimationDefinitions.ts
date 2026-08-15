import { IVec2, Orientation } from "@atbs/maths";
import { AnimationRecipe, DeathAnimation, PlayAnimation, SceneLeafNode } from "@atbs/shared-data";

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

export const DISORIENTATION_POINTS_PER_STAR = 20;
export const DISORIENTATION_ORBIT_MS = 7500;
export const DISORIENTATION_FADE_MS = 500;
export const DISORIENTATION_STAR_SIZE = 28;
export const DISORIENTATION_ORBIT_IMAGE_ID = "disorientation-shadow";

/**
 * Number of orbiting 💫 glyphs for a disorientation value. Any disoriented unit
 * shows at least one star; 18 → 1, 86 → 4, 100 → 5.
 */
export function disorientationStarCount(disorientation: number): number {
    if (disorientation <= 0) {
        return 0;
    }

    return Math.max(1, Math.round(disorientation / DISORIENTATION_POINTS_PER_STAR));
}

export function unitDisorientAnimId(unitId: string, index: number): string {
    return `anim-disorient-${unitId}-${index}`;
}

export interface DisorientationPlayAnimationsOptions {
    unitId: string;
    starCount: number;
    tileSize: number;
    fade?: boolean;
}

export function buildDisorientationPlayAnimations({
    unitId,
    starCount,
    tileSize,
    fade = false
}: DisorientationPlayAnimationsOptions): PlayAnimation[] {
    if (starCount <= 0) {
        return [];
    }

    const fadeRotationDelta = 360 * (DISORIENTATION_FADE_MS / DISORIENTATION_ORBIT_MS);
    const orbitRadius = (tileSize / 2) * 0.8;

    return Array.from({ length: starCount }, (_unused, index) => {
        const startDeg = (360 / starCount) * index;
        const instanceId = unitDisorientAnimId(unitId, index);

        return {
            instanceId,
            offset: 0,
            recipe: fade
                ? {
                      id: "disorientation-orbit-fade",
                      stateDef: {
                          scale: DISORIENTATION_STAR_SIZE,
                          orbitRadius,
                          opacity: [
                              1,
                              [
                                  {
                                      type: "linear" as const,
                                      startOffset: 0,
                                      duration: DISORIENTATION_FADE_MS,
                                      toValue: 0
                                  }
                              ]
                          ],
                          rotation: [
                              startDeg,
                              [
                                  {
                                      type: "linear" as const,
                                      startOffset: 0,
                                      duration: DISORIENTATION_FADE_MS,
                                      toValue: startDeg + fadeRotationDelta
                                  }
                              ]
                          ],
                          renderable: {
                              default: [{ imageId: DISORIENTATION_ORBIT_IMAGE_ID }]
                          }
                      }
                  }
                : {
                      id: "disorientation-orbit",
                      flags: { loop: true },
                      stateDef: {
                          scale: DISORIENTATION_STAR_SIZE,
                          orbitRadius,
                          opacity: 1,
                          rotation: [
                              startDeg,
                              [
                                  {
                                      type: "linear" as const,
                                      startOffset: 0,
                                      duration: DISORIENTATION_ORBIT_MS,
                                      toValue: startDeg + 360
                                  }
                              ]
                          ],
                          renderable: {
                              default: [{ imageId: DISORIENTATION_ORBIT_IMAGE_ID }]
                          }
                      }
                  }
        };
    });
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
