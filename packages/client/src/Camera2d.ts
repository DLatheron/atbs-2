import { Aabb, Maths, Vec2 } from "@atbs/maths";
import { TrackingSpeed } from "@atbs/shared-data";

export class Camera2d {
    private static readonly ADDITIONAL_VELOCITY_DAMPING = 0.98;

    private _worldPos: Vec2 = new Vec2();
    private _targetPos?: Vec2;
    private _targetCallback?: () => void;
    private _trackingSpeed: number = TrackingSpeed.enum.FAST;

    private _worldBounds?: Aabb;
    private _viewportDimensions?: Vec2;
    private _additionalVelocity: Vec2 | null = null;

    get worldPos() {
        return this._worldPos;
    }
    private set worldPos(worldPos: Vec2) {
        if (this.hasWorldBounds) {
            worldPos = this.constrainToBox(worldPos, this.worldBounds);
        }

        // if (!Vec2.IsEqual(this._worldPos, worldPos)) {
        this._worldPos = worldPos;
        // }
    }

    get targetPos() {
        return this._targetPos;
    }
    private set targetPos(targetPos: Vec2 | undefined) {
        this._targetPos = targetPos;
    }

    get trackingSpeed() {
        return this._trackingSpeed;
    }
    private set trackingSpeed(trackingSpeed: number) {
        this._trackingSpeed = Maths.Clamp(trackingSpeed, 0, 1);
    }

    get hasWorldBounds() {
        return !!this._worldBounds;
    }
    get worldBounds() {
        if (!this._worldBounds) {
            throw new Error("No world bounds set");
        }
        return this._worldBounds;
    }
    set worldBounds(worldBounds: Aabb) {
        // if (!Aabb.IsEqual(this._worldBounds, worldBounds)) {
        this._worldBounds = worldBounds;

        // Trigger setter so that world constraint is imposed.
        // eslint-disable-next-line no-self-assign
        this.worldPos = this.worldPos;
        // }
    }

    get hasViewportDimensions() {
        return !!this._viewportDimensions;
    }

    get viewportDimensions() {
        if (!this._viewportDimensions) {
            throw new Error("No viewport dimensions set");
        }
        return this._viewportDimensions;
    }
    set viewportDimensions(dimensions: Vec2) {
        this._viewportDimensions = dimensions;
    }

    get viewportHalfDimensions() {
        return this.viewportDimensions.divide(2);
    }

    get viewportTopLeft() {
        return new Vec2(
            this.worldPos.x - this.viewportHalfDimensions.x,
            this.worldPos.y - this.viewportHalfDimensions.y
        );
    }

    get viewportTopRight() {
        return new Vec2(
            this.worldPos.x + this.viewportHalfDimensions.x,
            this.worldPos.y - this.viewportHalfDimensions.y
        );
    }

    get viewportBottomLeft() {
        return new Vec2(
            this.worldPos.x - this.viewportHalfDimensions.x,
            this.worldPos.y + this.viewportHalfDimensions.y
        );
    }

    get viewportBottomRight() {
        return new Vec2(
            this.worldPos.x + this.viewportHalfDimensions.x,
            this.worldPos.y + this.viewportHalfDimensions.y
        );
    }

    get additionalVelocity(): Vec2 | null {
        return this._additionalVelocity;
    }

    set additionalVelocity(value: Vec2 | null) {
        this._additionalVelocity = value;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update({ time: _time, frameDelta: _frameDelta }: { time: number; frameDelta: number }) {
        const { targetPos } = this;
        if (targetPos) {
            this.worldPos = Vec2.Interpolate(this.worldPos, targetPos, this.trackingSpeed);

            if (this.worldPos.isEqual(targetPos, 1.0)) {
                this._targetCallback?.();
                this.targetPos = undefined;
            }

            let { additionalVelocity } = this;
            if (additionalVelocity) {
                this.interpolateByDelta(additionalVelocity, TrackingSpeed.enum.IMMEDIATE);

                additionalVelocity = additionalVelocity.scale(Camera2d.ADDITIONAL_VELOCITY_DAMPING);

                if (additionalVelocity.length <= 1) {
                    this._additionalVelocity = null;
                } else {
                    this._additionalVelocity = additionalVelocity;
                }
            }
        }
    }

    constrainToBox(pos: Vec2, { min, max }: Aabb) {
        const _min = min.add(this.viewportHalfDimensions);
        const _max = max.sub(this.viewportHalfDimensions);

        const newPos = new Vec2(pos.x, pos.y);

        if (newPos.x < _min.x) {
            newPos.x = _min.x;
        }
        if (newPos.x > _max.x) {
            newPos.x = _max.x;
        }

        if (newPos.y < _min.y) {
            newPos.y = _min.y;
        }
        if (newPos.y > _max.y) {
            newPos.y = _max.y;
        }

        return newPos;
    }

    canvasToWorld(canvasPos: Vec2): Vec2 {
        return this.viewportTopLeft.add(canvasPos);
    }

    worldToCanvas(worldPos: Vec2): Vec2 {
        return worldPos.sub(this.viewportTopLeft);
    }

    interpolateToWorldPos(
        targetPos: Vec2,
        trackingSpeed = TrackingSpeed.enum.FAST,
        callback?: () => void
    ) {
        this.targetPos = this.constrainToBox(targetPos, this.worldBounds);
        this._targetCallback = callback;
        this.trackingSpeed = trackingSpeed;
        this._additionalVelocity = null;
    }

    interpolateByDelta(
        delta: Vec2,
        trackingSpeed = TrackingSpeed.enum.VERY_SLOW,
        callback?: () => void
    ) {
        this.targetPos = this.constrainToBox(this.worldPos.sub(delta), this.worldBounds);
        this._targetCallback = callback;
        this.trackingSpeed = trackingSpeed;
        this._additionalVelocity = null;
    }
}
