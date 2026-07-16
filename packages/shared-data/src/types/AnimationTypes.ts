import { IColour, IVec2 } from "@atbs/maths";
import z from "zod";
import { ImageId } from "./PrimitiveTypes.js";

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

export const ImageIdState = z.string().nonempty().describe("The image ID of the animation");
export type ImageIdState = z.infer<typeof ImageIdState>;

export const ImageIdSequence = z
    .tuple([
        ImageIdState,
        z.array(makeSequenceDef(ImageIdState)).describe("The sequence of image IDs over time")
    ])
    .describe("The sequence of image IDs over time");
export type ImageIdSequence = z.infer<typeof ImageIdSequence>;

export const AnimationStateDef = z.object({
    scale: ScaleState.or(ScaleSequence).describe(
        "The scale of the animation or its sequence over time"
    ),
    opacity: OpacityState.or(OpacitySequence).describe(
        "The opacity of the animation or its sequence over time"
    ),
    imageId: ImageIdState.or(ImageIdSequence).describe(
        "The image ID of the animation or its sequence over time"
    )
});
export type AnimationStateDef = z.infer<typeof AnimationStateDef>;

export const AnimationState = z.object({
    scale: ScaleState,
    opacity: OpacityState,
    imageId: ImageIdState
});
export type AnimationState = z.infer<typeof AnimationState>;

export const AnimationRecipe = z.object({
    id: AnimationId,
    stateDef: AnimationStateDef.describe("The definition of each animation property overtime")
});
export type AnimationRecipe = z.infer<typeof AnimationRecipe>;

export const PlayAnimation = z
    .object({
        worldPos: IVec2,
        recipe: AnimationRecipe
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

export function interpolateImageId(fromValue: ImageId, toValue: ImageId, t: number) {
    return t < 0.5 ? fromValue : toValue;
}
