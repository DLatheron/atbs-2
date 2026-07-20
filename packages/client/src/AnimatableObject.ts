import { Vec2 } from "@atbs/maths";
import { Logger, LogLevel } from "@atbs/misc";
import { AnimatableObjectRecipe, AnimationRecipe, InstanceId } from "@atbs/shared-data";
import { Animation } from "./Animation.js";
import { AnimationController } from "./AnimationController.js";
import { cloneDeep } from "lodash";
import { Camera2d } from "./Camera2d.js";
import { ImageCache } from "./ImageCache.js";

export class AnimatableObject {
    private readonly _logger: Logger;

    private readonly _animationController: AnimationController;
    private readonly _recipe: AnimatableObjectRecipe;
    private _worldPos: Vec2 | undefined;
    private _animation: Animation | null;
    private _startTime: number | undefined;
    private _animationQueue: AnimationRecipe[] = [];

    constructor(recipe: AnimatableObjectRecipe, animationController: AnimationController) {
        this._animationController = animationController;
        this._recipe = recipe;
        this._worldPos = recipe.worldPos ? new Vec2(recipe.worldPos) : undefined;
        this._animation = null;
        this._animationQueue = cloneDeep(recipe.recipes);

        this._logger = new Logger(this.instanceId, LogLevel.enum.warn);
    }

    get instanceId(): InstanceId {
        return this._recipe.instanceId;
    }

    hasWorldPos(): boolean {
        return this._worldPos !== undefined;
    }

    get worldPos(): Vec2 | undefined {
        return this._worldPos;
    }

    set worldPos(value: Vec2) {
        this._worldPos = value;
    }

    playNextAnimation(time: number) {
        const animationRecipe = this._animationQueue.shift();
        if (animationRecipe) {
            this._logger.debug(`Animation ${this._animation?.id} started at ${time}`);
            this._animation = this._animationController.newAnimation(
                {
                    instanceId: this.instanceId,
                    offset: 0,
                    recipe: animationRecipe
                },
                (time) => {
                    this._logger.debug(`Animation ${this._animation?.id} completed at ${time}`);
                    this.playNextAnimation(time);
                }
            );
        }
    }

    update(time: number) {
        if (this._startTime === undefined) {
            this._startTime = time;
            this.playNextAnimation(time);
        }

        const elapsedTimeIntoAnimation = time - this._startTime;
        this._logger.debug("Updating animatable object", { time, elapsedTimeIntoAnimation });

        // TODO: Start any new animations - update and inprogress ones etc.

        // TODO: Update any inprogress animations.
        // if (this._animation) {
        //     this._animation.update(time);
        // }

        // TODO: Switch animations... etc.
    }

    // TODO: Render (only if hasWorldPos - otherwise rendered by controller).

    render({
        camera,
        context,
        canvasPos,
        imageCache
    }: {
        camera: Camera2d;
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        canvasPos: Vec2;
        imageCache: ImageCache;
    }) {
        if (!this._animation) {
            return;
        }

        if (this._worldPos) {
            this._animation?.renderToWorld({
                camera,
                context,
                worldPos: this._worldPos,
                imageCache
            });
        } else {
            this._animation.renderToCanvas({ context, canvasPos, imageCache });
        }
    }
}
