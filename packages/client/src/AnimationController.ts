import { AnimationId, PlayAnimation } from "@atbs/shared-data";
import { Animation } from "./Animation";
import { ImageCache } from "./ImageCache";
import { Vec2 } from "@atbs/maths";

export class AnimationController {
    private _imageCache: ImageCache;
    private _animationMap: Map<AnimationId, Animation>;
    private _lastUpdateTime: number;

    constructor(imageCache: ImageCache) {
        this._imageCache = imageCache;
        this._animationMap = new Map<AnimationId, Animation>();
        this._lastUpdateTime = 0;
    }

    get imageCache(): ImageCache {
        return this._imageCache;
    }

    newAnimation(playAnimation: PlayAnimation) {
        const animation = new Animation(playAnimation, { startTime: this._lastUpdateTime });

        this._animationMap.set(animation.id, animation);

        return animation.id;
    }

    removeAnimation(animationId: AnimationId) {
        this._animationMap.delete(animationId);
    }

    update({ time }: { time: number; frameDelta: number }) {
        for (const animation of this._animationMap.values()) {
            animation.update(time);
        }

        this._lastUpdateTime = time;
    }

    renderAnimation(
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        animationId: AnimationId,
        canvasPos: Vec2
    ) {
        const animation = this._animationMap.get(animationId);
        if (!animation) {
            return;
        }

        const { imageCache } = this;

        animation.renderToCanvas({
            context,
            canvasPos,
            imageCache
        });
    }
}
