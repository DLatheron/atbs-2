import { IColour, IVec2, Orientation } from "@atbs/maths";
import z from "zod";
import { InstanceId } from "./PrimitiveTypes.js";
import { SceneNode } from "./SceneObject.js";

export const AnimationId = z.string().nonempty().describe("The ID of the animation");
export type AnimationId = z.infer<typeof AnimationId>;

const sequenceType = ["linear", "ease-in", "ease-out", "ease-in-out"] as const;
export const SequenceType = z.enum(sequenceType);
export type SequenceType = z.infer<typeof SequenceType>;

export function makeSequenceDef<TValue extends z.ZodTypeAny>(toValue: TValue) {
    const base = {
        startOffset: z
            .number()
            .nonnegative()
            .describe("The offset from the start of the animation in milliseconds"),
        duration: z
            .number()
            .nonnegative()
            .describe("The duration of the animation in milliseconds"),
        toValue: toValue.describe("The value to animate to (at the end of the animation)")
    };

    return z.discriminatedUnion("type", [
        z.object({ type: z.literal("linear"), ...base }),
        z.object({ type: z.literal("ease-in"), powerIn: z.number().nonnegative(), ...base }),
        z.object({ type: z.literal("ease-out"), powerOut: z.number().nonnegative(), ...base }),
        z.object({
            type: z.literal("ease-in-out"),
            powerIn: z.number().nonnegative(),
            powerOut: z.number().nonnegative(),
            ...base
        })
    ]);
}

export const ScaleState = z.number().nonnegative().describe("The scale of the animation");
export type ScaleState = z.infer<typeof ScaleState>;

export const ScaleSequence = z
    .tuple([
        ScaleState,
        z.array(makeSequenceDef(ScaleState)).describe("The sequence of scale values over time")
    ])
    .describe("The sequence of scale values over time");
export type ScaleSequence = z.infer<typeof ScaleSequence>;

export const OpacityState = z.number().min(0).max(1).describe("The opacity of the animation");
export type OpacityState = z.infer<typeof OpacityState>;

export const OpacitySequence = z
    .tuple([
        OpacityState,
        z.array(makeSequenceDef(OpacityState)).describe("The sequence of opacity values over time")
    ])
    .describe("The sequence of opacity values over time");
export type OpacitySequence = z.infer<typeof OpacitySequence>;

export const RotationState = z.number().describe("The rotation of the animation");
export type RotationState = z.infer<typeof RotationState>;

export const RotationSequence = z
    .tuple([
        RotationState,
        z
            .array(makeSequenceDef(RotationState))
            .describe("The sequence of rotation values over time")
    ])
    .describe("The sequence of rotation values over time");
export type RotationSequence = z.infer<typeof RotationSequence>;

export const OrientationState = z.enum(Orientation).describe("The orientation of the animation");
export type OrientationState = z.infer<typeof OrientationState>;

export const OrientationSequence = z
    .tuple([
        OrientationState,
        z
            .array(makeSequenceDef(OrientationState))
            .describe("The sequence of orientation values over time")
    ])
    .describe("The sequence of orientation values over time");
export type OrientationSequence = z.infer<typeof OrientationSequence>;

export const FrameState = z
    .number()
    .int()
    .nonnegative()
    .describe("The current animation frame index");
export type FrameState = z.infer<typeof FrameState>;

export const FrameSequence = z
    .tuple([
        FrameState,
        z.array(makeSequenceDef(FrameState)).describe("The sequence of frame indices over time")
    ])
    .describe("The sequence of frame indices over time");
export type FrameSequence = z.infer<typeof FrameSequence>;

export const AnimationStateDef = z.object({
    scale: ScaleState.or(ScaleSequence)
        .describe("The scale of the animation or its sequence over time")
        .optional(),
    opacity: OpacityState.or(OpacitySequence)
        .describe("The opacity of the animation or its sequence over time")
        .optional(),
    rotation: RotationState.or(RotationSequence)
        .describe("The rotation of the animation or its sequence over time")
        .optional(),
    orientation: z
        .enum(Orientation)
        .or(OrientationSequence)
        .describe("The orientation of the animation or its sequence over time")
        .optional(),
    frame: FrameState.or(FrameSequence)
        .describe("The scene node frame index or its sequence over time")
        .optional(),
    renderable: SceneNode.describe("The renderable of the animation")
});
export type AnimationStateDef = z.infer<typeof AnimationStateDef>;

export const AnimationState = z.object({
    scale: ScaleState,
    opacity: OpacityState,
    rotation: RotationState,
    orientation: OrientationState,
    frame: FrameState
});
export type AnimationState = z.infer<typeof AnimationState>;

export const AnimationRecipe = z.object({
    id: AnimationId,
    flags: z.object({ loop: z.boolean().describe("Whether the animation should loop") }).optional(),
    stateDef: AnimationStateDef.describe("The definition of each animation property overtime")
});
export type AnimationRecipe = z.infer<typeof AnimationRecipe>;

export const PlayAnimation = z
    .object({
        instanceId: AnimationId,
        offset: z
            .number()
            .nonnegative()
            .describe("The offset from the start of the animation in milliseconds")
            .default(0),
        recipe: AnimationRecipe,
        worldPos: IVec2.optional().describe("The world position of the animation")
    })
    .describe("The animation to play");
export type PlayAnimation = z.infer<typeof PlayAnimation>;

export function interpolateNumber(fromValue: number, toValue: number, t: number) {
    return fromValue + (toValue - fromValue) * t;
}

export function interpolateColor(fromValue: IColour, toValue: IColour, t: number) {
    return {
        r: interpolateNumber(fromValue.r, toValue.r, t),
        g: interpolateNumber(fromValue.g, toValue.g, t),
        b: interpolateNumber(fromValue.b, toValue.b, t),
        a: interpolateNumber(fromValue.a, toValue.a, t)
    };
}

export function interpolateVec2(fromValue: IVec2, toValue: IVec2, t: number) {
    return {
        x: interpolateNumber(fromValue.x, toValue.x, t),
        y: interpolateNumber(fromValue.y, toValue.y, t)
    };
}

export function interpolateFrame(fromValue: number, toValue: number, t: number) {
    return Math.floor(interpolateNumber(fromValue, toValue, t));
}

export function interpolateOrientation(
    fromValue: OrientationState,
    toValue: OrientationState,
    t: number
): OrientationState {
    return t < 0.5 ? fromValue : toValue;
}

export const AnimatableObjectRecipe = z.object({
    instanceId: InstanceId.nonempty().describe("The unique ID of the animatable object"),
    worldPos: IVec2.optional().describe(
        "The world position of the animatable object, if not specified then its referenced from the world's render list"
    ),
    recipes: z.array(AnimationRecipe).describe("The recipes of the animatable object")
});
export type AnimatableObjectRecipe = z.infer<typeof AnimatableObjectRecipe>;
