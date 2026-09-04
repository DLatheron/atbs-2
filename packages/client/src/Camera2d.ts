import { Aabb, clamp, lerp, Vec2 } from "@atbs/maths";
import { TrackingSpeed } from "@atbs/shared-data";
import { getMinZoom, MapCameraConfig } from "./MapCameraConfig";

export class Camera2d {
    private static readonly ADDITIONAL_VELOCITY_DAMPING = 0.98;

    private _worldPos: Vec2 = new Vec2();
    private _targetPos?: Vec2;
    private _targetCallback?: () => void;
    private _trackingSpeed: number = TrackingSpeed.enum.FAST;

    private _worldBounds?: Aabb;
    private _viewportDimensions?: Vec2;
    private _additionalVelocity: Vec2 | null = null;

    private _zoom: number = MapCameraConfig.maxZoom;
    private _targetZoom: number = MapCameraConfig.maxZoom;
    private _zoomFocus: { canvasPos: Vec2; worldPos: Vec2 } | null = null;

    private _maxZoom: number = MapCameraConfig.maxZoom;
    private _minZoom: number = getMinZoom();
    private _zoomSmoothing: number = MapCameraConfig.zoomSmoothing;
    private _wheelZoomSensitivity: number = MapCameraConfig.wheelZoomSensitivity;

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
        this._trackingSpeed = clamp(trackingSpeed, 0, 1);
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

    /** Half the viewport size in world units (accounts for zoom). */
    get viewportHalfDimensions() {
        return this.viewportDimensions.divide(2 * this.zoom);
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

    /** Current displayed zoom (1 = max zoom-in / default view). */
    get zoom() {
        return this._zoom;
    }

    get targetZoom() {
        return this._targetZoom;
    }

    get minZoom() {
        return this._minZoom;
    }

    get maxZoom() {
        return this._maxZoom;
    }

    /**
     * Override zoom limits / feel. Useful for tests or runtime tuning.
     * Values default to {@link MapCameraConfig}.
     */
    configureZoom(options: {
        maxZoom?: number;
        maxZoomOutFactor?: number;
        zoomSmoothing?: number;
        wheelZoomSensitivity?: number;
    }) {
        if (options.maxZoom !== undefined) {
            this._maxZoom = options.maxZoom;
        }
        if (options.maxZoomOutFactor !== undefined || options.maxZoom !== undefined) {
            this._minZoom = getMinZoom({
                maxZoom: this._maxZoom,
                maxZoomOutFactor: options.maxZoomOutFactor ?? MapCameraConfig.maxZoomOutFactor
            });
        }
        if (options.zoomSmoothing !== undefined) {
            this._zoomSmoothing = clamp(options.zoomSmoothing, 0, 1);
        }
        if (options.wheelZoomSensitivity !== undefined) {
            this._wheelZoomSensitivity = Math.max(0, options.wheelZoomSensitivity);
        }

        this._zoom = clamp(this._zoom, this._minZoom, this._maxZoom);
        this._targetZoom = clamp(this._targetZoom, this._minZoom, this._maxZoom);
        // eslint-disable-next-line no-self-assign
        this.worldPos = this.worldPos;
    }

    /** Convert a length in world units to canvas pixels at the current zoom. */
    worldLengthToCanvas(length: number): number {
        return length * this.zoom;
    }

    /** Convert a canvas-pixel delta into a world-space delta at the current zoom. */
    canvasDeltaToWorldDelta(canvasDelta: Vec2): Vec2 {
        return canvasDelta.divide(this.zoom);
    }

    /**
     * Continuous zoom toward/away from `canvasPos` (typically the cursor).
     * `deltaY` follows the wheel event convention (positive = zoom out).
     */
    zoomByWheel(deltaY: number, canvasPos: Vec2) {
        if (!this.hasViewportDimensions || deltaY === 0) {
            return;
        }

        const worldPos = this.canvasToWorld(canvasPos);
        const zoomFactor = Math.exp(-deltaY * this._wheelZoomSensitivity);
        this._targetZoom = clamp(this._targetZoom * zoomFactor, this._minZoom, this._maxZoom);
        this._zoomFocus = { canvasPos, worldPos };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update({ time: _time, frameDelta: _frameDelta }: { time: number; frameDelta: number }) {
        this.updateZoom();

        const { targetPos } = this;
        if (targetPos) {
            this.worldPos = Vec2.Interpolate(this.worldPos, targetPos, this.trackingSpeed);

            if (this.worldPos.isEqual(targetPos, 1.0)) {
                this._targetCallback?.();
                this.targetPos = undefined;
            }
        }

        this.updateAdditionalVelocity();
    }

    private updateAdditionalVelocity() {
        const velocity = this._additionalVelocity;
        if (!velocity) {
            return;
        }

        const before = this.worldPos;
        const desired = before.sub(velocity);
        const after = this.constrainToBox(desired, this.worldBounds);

        // Assign through the setter so bounds stay enforced.
        this.worldPos = after;

        // Hard-stop: kill inertia on any axis that hit the bound this frame.
        const hitX = Math.abs(after.x - desired.x) > 1e-6;
        const hitY = Math.abs(after.y - desired.y) > 1e-6;
        let nextVelocity = new Vec2(hitX ? 0 : velocity.x, hitY ? 0 : velocity.y);
        nextVelocity = nextVelocity.scale(Camera2d.ADDITIONAL_VELOCITY_DAMPING);

        if (nextVelocity.length <= 1) {
            this._additionalVelocity = null;
        } else {
            this._additionalVelocity = nextVelocity;
        }
    }

    private updateZoom() {
        if (Math.abs(this._zoom - this._targetZoom) < 1e-5) {
            this._zoom = this._targetZoom;
            this._zoomFocus = null;
            return;
        }

        this._zoom = lerp(this._zoom, this._targetZoom, this._zoomSmoothing);

        if (this._zoomFocus && this.hasViewportDimensions) {
            const { canvasPos, worldPos } = this._zoomFocus;
            this.worldPos = this.worldPosForCanvasPoint(canvasPos, worldPos);
        } else {
            // eslint-disable-next-line no-self-assign
            this.worldPos = this.worldPos;
        }

        if (Math.abs(this._zoom - this._targetZoom) < 1e-4) {
            this._zoom = this._targetZoom;
            this._zoomFocus = null;
        }
    }

    /** Camera world position such that `worldPos` appears at `canvasPos`. */
    private worldPosForCanvasPoint(canvasPos: Vec2, worldPos: Vec2): Vec2 {
        const offsetFromCenter = canvasPos.sub(this.viewportDimensions.divide(2));
        return worldPos.sub(offsetFromCenter.divide(this.zoom));
    }

    /** Set the camera position immediately, cancelling interpolation / zoom focus. */
    setWorldPosImmediate(worldPos: Vec2, options?: { clearVelocity?: boolean }) {
        this.targetPos = undefined;
        this._targetCallback = undefined;
        this._zoomFocus = null;
        if (options?.clearVelocity !== false) {
            this._additionalVelocity = null;
        }
        this.worldPos = worldPos;
    }

    clearZoomFocus() {
        this._zoomFocus = null;
    }

    constrainToBox(pos: Vec2, { min, max }: Aabb) {
        if (!this.hasViewportDimensions) {
            return new Vec2(pos.x, pos.y);
        }

        const half = this.viewportHalfDimensions;
        const minBound = min.add(half);
        const maxBound = max.sub(half);

        const newPos = new Vec2(pos.x, pos.y);

        // When the map is smaller than the viewport, minBound > maxBound.
        // Clamp into [maxBound, minBound] so the map can be repositioned within the
        // screen without the classic "always snap to maxBound" sequential-clamp bug.
        if (minBound.x > maxBound.x) {
            newPos.x = clamp(pos.x, maxBound.x, minBound.x);
        } else {
            newPos.x = clamp(pos.x, minBound.x, maxBound.x);
        }

        if (minBound.y > maxBound.y) {
            newPos.y = clamp(pos.y, maxBound.y, minBound.y);
        } else {
            newPos.y = clamp(pos.y, minBound.y, maxBound.y);
        }

        return newPos;
    }

    canvasToWorld(canvasPos: Vec2): Vec2 {
        return this.viewportTopLeft.add(canvasPos.divide(this.zoom));
    }

    worldToCanvas(worldPos: Vec2): Vec2 {
        return worldPos.sub(this.viewportTopLeft).scale(this.zoom);
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
