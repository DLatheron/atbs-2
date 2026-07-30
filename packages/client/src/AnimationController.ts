import { AnimatableObjectRecipe, AnimationId, InstanceId, PlayAnimation } from "@atbs/shared-data";
import { Animation } from "./Animation";
import { ImageCache } from "./ImageCache";
import { Vec2 } from "@atbs/maths";
import { AnimatableObject } from "./AnimatableObject";
import { Camera2d } from "./Camera2d";

export class AnimationController {
    private _imageCache: ImageCache;
    private _animationMap: Map<AnimationId, Animation>;
    private _animatableObjectMap: Map<InstanceId, AnimatableObject>;
    private _lastUpdateTime: number;

    constructor(imageCache: ImageCache) {
        this._imageCache = imageCache;
        this._animationMap = new Map<AnimationId, Animation>();
        this._animatableObjectMap = new Map<InstanceId, AnimatableObject>();
        this._lastUpdateTime = 0;
    }

    get imageCache(): ImageCache {
        return this._imageCache;
    }

    newAnimation(
        playAnimation: PlayAnimation,
        completeCallback?: (time: number) => void
    ): Animation {
        const animation = new Animation(
            playAnimation,
            { startTime: this._lastUpdateTime },
            completeCallback,
            this._imageCache
        );

        this._animationMap.set(animation.id, animation);

        return animation;
    }

    newAnimatableObject(animatableObjectRecipe: AnimatableObjectRecipe) {
        const animatableObject = new AnimatableObject(animatableObjectRecipe, this);

        this._animatableObjectMap.set(animatableObject.instanceId, animatableObject);

        return animatableObject;
    }

    removeAnimation(animationId: AnimationId) {
        this._animationMap.delete(animationId);
    }

    removeAnimatableObject(instanceId: InstanceId) {
        this._animatableObjectMap.delete(instanceId);
    }

    update({ time }: { time: number; frameDelta: number }) {
        for (const animatableObject of this._animatableObjectMap.values()) {
            animatableObject.update(time);
        }

        for (const animation of this._animationMap.values()) {
            animation.update(time);
        }

        this._lastUpdateTime = time;
    }

    render({
        camera,
        context
    }: {
        camera: Camera2d;
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    }) {
        const { imageCache } = this;

        for (const animation of this._animationMap.values()) {
            if (animation.hasWorldPos) {
                animation.renderToWorld({
                    camera,
                    context,
                    worldPos: animation.worldPos,
                    imageCache
                });
            }
        }
    }

    renderAnimation(
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        animationId: AnimationId,
        canvasPos: Vec2,
        sizeScale = 1
    ) {
        const animation = this._animationMap.get(animationId);
        if (!animation) {
            return;
        }

        const { imageCache } = this;

        animation.renderToCanvas({
            context,
            canvasPos,
            imageCache,
            sizeScale
        });
    }
}
