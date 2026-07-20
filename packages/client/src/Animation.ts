import { clamp, Vec2 } from "@atbs/maths";
import { Logger, LogLevel } from "@atbs/misc";
import {
    AnimationId,
    AnimationRecipe,
    AnimationState,
    ImageIdSequence,
    ImageIdState,
    InstanceId,
    interpolateImageId,
    interpolateNumber,
    OpacitySequence,
    OpacityState,
    PlayAnimation,
    ScaleSequence,
    ScaleState
} from "@atbs/shared-data";
import z from "zod";
import { DrawVfx, DrawVfxToCanvas } from "./RenderHelpers";
import { ImageCache } from "./ImageCache";
import { Camera2d } from "./Camera2d";

export const AnimationOverrides = z
    .object({
        startTime: z.number().nonnegative(),
        instanceIndex: z.number().nonnegative()
    })
    .partial();
export type AnimationOverrides = z.infer<typeof AnimationOverrides>;

export class Animation {
    readonly logger: Logger;

    private readonly _id: InstanceId;
    private readonly _recipe: AnimationRecipe;
    private readonly _flags: { loop: boolean };
    private _completeCallback?: (time: number) => void;

    private _state: AnimationState;
    private _startTime: number | undefined;
    private _duration: number;

    constructor(
        { instanceId, recipe }: PlayAnimation,
        overrides: Readonly<AnimationOverrides> = {},
        completeCallback?: (time: number) => void
    ) {
        this._id = instanceId;
        this._recipe = recipe;
        this._flags = recipe.flags ?? { loop: false };
        this.logger = new Logger(this.id, LogLevel.enum.warn);
        this._startTime = overrides.startTime ?? undefined;
        this._duration = Animation._PreCalculateDuration(recipe);
        this._completeCallback = completeCallback;

        // Ensure we have a valid state.
        this._state = this.evaluateState(this._startTime ?? 0);
    }

    get id(): InstanceId {
        return this._id;
    }

    get recipeId(): AnimationId {
        return this._recipe.id;
    }

    get state(): AnimationState {
        return this._state;
    }

    get startTime(): number | undefined {
        return this._startTime;
    }

    get duration(): number {
        return this._duration;
    }

    set startTime(value: number) {
        if (this._startTime !== undefined) {
            throw new Error("Animation has already been started");
        }

        this.logger.debug("Starting animation", { value });
        this._startTime = value;
    }

    private static _PreCalculateDuration(recipe: AnimationRecipe): number {
        let duration = 0;

        for (const property of Object.values(recipe.stateDef)) {
            if (!Array.isArray(property)) {
                continue;
            }

            for (const sequence of property[1]) {
                duration = Math.max(duration, sequence.startOffset + sequence.duration);
            }
        }

        return duration;
    }

    private evaluateStateValue<TValue, TSequence>(
        name: string,
        value: TValue | TSequence,
        elapsedTimeIntoAnimation: number,
        evaluateValue: (fromValue: TValue, toValue: TValue, t: number) => TValue
    ): TValue {
        this.logger.debug(`Evaluating state value: ${name} at time ${elapsedTimeIntoAnimation}`);
        // this.logger.group();
        if (!Array.isArray(value)) {
            this.logger.debug("Evaluating static state value", { value });
            this.logger.groupEnd();
            return value as TValue;
        }

        let [fromValue] = value;

        this.logger.debug("Evaluating sequence state value", { value });
        for (const sequence of value[1]) {
            const { type, startOffset, duration, toValue } = sequence;

            if (elapsedTimeIntoAnimation < startOffset) {
                break;
            }

            const t = clamp((elapsedTimeIntoAnimation - startOffset) / duration, 0, 1);

            const newValue = evaluateValue(fromValue, toValue, t);
            this.logger.debug("Evaluating sequence value", {
                type,
                fromValue,
                toValue,
                t,
                newValue
            });
            fromValue = newValue;
        }

        this.logger.groupEnd();
        return fromValue;
    }

    private evaluateState(elapsedTimeIntoAnimation: number): AnimationState {
        return {
            scale: this.evaluateStateValue<ScaleState, ScaleSequence>(
                "scale",
                this._recipe.stateDef.scale,
                elapsedTimeIntoAnimation,
                interpolateNumber
            ),
            opacity: this.evaluateStateValue<OpacityState, OpacitySequence>(
                "opacity",
                this._recipe.stateDef.opacity,
                elapsedTimeIntoAnimation,
                interpolateNumber
            ),
            imageId: this.evaluateStateValue<ImageIdState, ImageIdSequence>(
                "imageId",
                this._recipe.stateDef.imageId,
                elapsedTimeIntoAnimation,
                interpolateImageId
            )
        };
    }

    update(time: number) {
        if (this._startTime === undefined) {
            this._startTime = time;
        }

        const elapsedTimeIntoAnimation = this._flags.loop
            ? (time - this._startTime) % this.duration
            : time - this._startTime;
        this.logger.debug("Updating animation", { time, elapsedTimeIntoAnimation });

        this._state = this.evaluateState(elapsedTimeIntoAnimation);

        if (this._completeCallback && elapsedTimeIntoAnimation >= this.duration) {
            this._completeCallback(time);
            this._completeCallback = undefined;
        }
    }

    renderToWorld({
        camera,
        context,
        worldPos,
        imageCache
    }: {
        camera: Camera2d;
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        worldPos: Vec2;
        imageCache: ImageCache;
    }) {
        const { imageId, scale, opacity } = this._state;

        imageCache.requestImage(imageId);
        if (!imageCache.isLoaded(imageId)) {
            return;
        }

        DrawVfx(camera, context, imageCache.getImage(imageId), worldPos, scale, opacity, 0);
    }

    renderToCanvas({
        context,
        canvasPos,
        imageCache
    }: {
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        canvasPos: Vec2;
        imageCache: ImageCache;
    }) {
        const { imageId, scale, opacity } = this._state;

        imageCache.requestImage(imageId);
        if (!imageCache.isLoaded(imageId)) {
            return;
        }

        DrawVfxToCanvas(context, imageCache.getImage(imageId), canvasPos, scale, opacity, 0);
    }
}
