import { AnimationId, PlayAnimation } from "@atbs/shared-data";
import { Animation } from "./Animation";
import { ImageCache } from "./ImageCache";
import { Camera2d } from "./Camera2d";
import { Vec2 } from "@atbs/maths";

export class AnimationController {
    private _imageCache: ImageCache;
    private _animationInstances: {
        animation: Animation;
        worldPos: Vec2;
    }[];
    private _animationInstanceIndex: number;

    constructor(imageCache: ImageCache) {
        this._imageCache = imageCache;
        this._animationInstances = [];
        this._animationInstanceIndex = 0;
    }

    get imageCache(): ImageCache {
        return this._imageCache;
    }

    newAnimation(playAnimation: PlayAnimation) {
        const animation = new Animation(playAnimation.recipe, {
            instanceIndex: this._animationInstanceIndex++
            // TODO: Location etc.
        });

        this._animationInstances.push({ animation, worldPos: new Vec2(playAnimation.worldPos) });

        return animation.id;
    }

    removeAnimation(animationId: AnimationId) {
        this._animationInstances = this._animationInstances.filter(
            ({ animation }) => animation.id !== animationId
        );
    }

    update({ time }: { time: number; frameDelta: number }) {
        for (const { animation } of this._animationInstances) {
            animation.update(time);
        }
    }

    render({
        camera,
        context
    }: {
        camera: Camera2d;
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    }) {
        const { imageCache } = this;

        for (const { animation, worldPos } of this._animationInstances) {
            animation.render({
                camera,
                context,
                worldPos,
                imageCache
            });
        }
    }
}
