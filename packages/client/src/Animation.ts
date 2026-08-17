import { clamp, Orientation, Vec2 } from "@atbs/maths";
import { Logger, LogLevel } from "@atbs/misc";
import {
    AnimationId,
    AnimationRecipe,
    AnimationState,
    FrameSequence,
    FrameState,
    InstanceId,
    interpolateFrame,
    interpolateNumber,
    interpolateOrientation,
    interpolateVec2,
    OpacitySequence,
    OpacityState,
    OrientationSequence,
    OrientationState,
    PlayAnimation,
    RenderMode,
    RotationSequence,
    RotationState,
    ScaleSequence,
    ScaleState,
    SceneObject,
    TranslationSequence,
    TranslationState
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

export class Animation extends SceneObject {
    readonly logger: Logger;

    private readonly _id: InstanceId;
    private readonly _recipe: AnimationRecipe;
    private readonly _worldPos: Vec2 | undefined;
    private readonly _flags: { loop: boolean };
    private _completeCallback?: (time: number) => void;

    private _state: AnimationState;
    private _startTime: number | undefined;
    private _duration: number;

    constructor(
        { instanceId, recipe, worldPos }: PlayAnimation,
        overrides: Readonly<AnimationOverrides> = {},
        completeCallback?: (time: number) => void,
        imageCache?: ImageCache
    ) {
        super(recipe.stateDef.renderable);

        this._id = instanceId;
        this._recipe = recipe;
        this._worldPos = worldPos ? new Vec2(worldPos) : undefined;
        this._flags = recipe.flags ?? { loop: false };
        this.logger = new Logger(this.id, LogLevel.enum.warn);
        this._startTime = overrides.startTime ?? undefined;
        this._duration = Animation._PreCalculateDuration(recipe);
        this._completeCallback = completeCallback;

        // Ensure we have a valid state.
        this._state = this.evaluateState(this._startTime ?? 0);

        // Pre-warm the cache for every image this animation could render, so
        // frames/states/orientations are available before they are first shown.
        if (imageCache) {
            this.forEachImageId((imageId) => imageCache.requestImage(imageId));
        }
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

    get hasWorldPos(): boolean {
        return this._worldPos !== undefined;
    }

    get worldPos(): Vec2 {
        if (!this._worldPos) {
            throw new Error("Animation does not have a world position");
        }

        return this._worldPos;
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
            scale: this._recipe.stateDef.scale
                ? this.evaluateStateValue<ScaleState, ScaleSequence>(
                      "scale",
                      this._recipe.stateDef.scale,
                      elapsedTimeIntoAnimation,
                      interpolateNumber
                  )
                : 100,
            opacity: this._recipe.stateDef.opacity
                ? this.evaluateStateValue<OpacityState, OpacitySequence>(
                      "opacity",
                      this._recipe.stateDef.opacity,
                      elapsedTimeIntoAnimation,
                      interpolateNumber
                  )
                : 1,
            rotation: this._recipe.stateDef.rotation
                ? this.evaluateStateValue<RotationState, RotationSequence>(
                      "rotation",
                      this._recipe.stateDef.rotation,
                      elapsedTimeIntoAnimation,
                      interpolateNumber
                  )
                : 0,
            orbitRadius: this._recipe.stateDef.orbitRadius
                ? this.evaluateStateValue<ScaleState, ScaleSequence>(
                      "orbitRadius",
                      this._recipe.stateDef.orbitRadius,
                      elapsedTimeIntoAnimation,
                      interpolateNumber
                  )
                : 0,
            orientation: this._recipe.stateDef.orientation
                ? this.evaluateStateValue<OrientationState, OrientationSequence>(
                      "orientation",
                      this._recipe.stateDef.orientation,
                      elapsedTimeIntoAnimation,
                      interpolateOrientation
                  )
                : Orientation.NORTH,
            frame: this._recipe.stateDef.frame
                ? this.evaluateStateValue<FrameState, FrameSequence>(
                      "frame",
                      this._recipe.stateDef.frame,
                      elapsedTimeIntoAnimation,
                      interpolateFrame
                  )
                : 0,
            translation: this._recipe.stateDef.translation
                ? this.evaluateStateValue<TranslationState, TranslationSequence>(
                      "translation",
                      this._recipe.stateDef.translation,
                      elapsedTimeIntoAnimation,
                      interpolateVec2
                  )
                : { x: 50, y: 50 }
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
        imageCache,
        tileSize = 100
    }: {
        camera: Camera2d;
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        worldPos: Vec2;
        imageCache: ImageCache;
        tileSize?: number;
    }) {
        const { scale, opacity, rotation, orientation, frame, orbitRadius, translation } =
            this._state;

        const renderList = this.getRenderList({
            renderMode: RenderMode.enum.MAP_MODE,
            orientation,
            opacity,
            frame,
            states: ["default"]
        });

        const translatedWorldPos = worldPos.add({
            x: ((translation.x - 50) / 100) * tileSize,
            y: ((translation.y - 50) / 100) * tileSize
        });

        for (const renderable of renderList) {
            if (!imageCache.isLoaded(renderable.imageId)) {
                return;
            }

            DrawVfx(
                camera,
                context,
                imageCache.getImage(renderable.imageId),
                translatedWorldPos,
                camera.worldLengthToCanvas(scale),
                renderable.opacity ?? opacity,
                rotation,
                camera.worldLengthToCanvas(orbitRadius)
            );
        }
    }

    renderToCanvas({
        context,
        canvasPos,
        imageCache,
        sizeScale = 1,
        tileSize = 100
    }: {
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        canvasPos: Vec2;
        imageCache: ImageCache;
        sizeScale?: number;
        tileSize?: number;
    }) {
        const { scale, opacity, rotation, orientation, frame, orbitRadius, translation } =
            this._state;

        const renderList = this.getRenderList({
            renderMode: RenderMode.enum.MAP_MODE,
            orientation,
            opacity,
            frame,
            states: ["default"]
        });

        const translatedCanvasPos = canvasPos.add({
            x: ((translation.x - 50) / 100) * tileSize * sizeScale,
            y: ((translation.y - 50) / 100) * tileSize * sizeScale
        });

        for (const renderable of renderList) {
            if (!imageCache.isLoaded(renderable.imageId)) {
                return;
            }

            DrawVfxToCanvas(
                context,
                imageCache.getImage(renderable.imageId),
                translatedCanvasPos,
                scale * sizeScale,
                renderable.opacity ?? opacity,
                rotation,
                orbitRadius * sizeScale
            );
        }
    }
}
