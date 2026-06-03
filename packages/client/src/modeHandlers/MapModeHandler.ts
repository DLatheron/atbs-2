import { World } from "../World";
import { TrackingSpeed } from "../Camera2d";
import { TilePos, Vec2 } from "@atbs/maths";
import { ModeHandler } from "./ModeHandler";

export class MapModeHandler extends ModeHandler {
    private static readonly MOUSE_SPEED_SCALER = 1.0;
    private static readonly DRAG_DAMPING = 0.98;

    private _mapDrag: {
        worldPos: Vec2;
        baseCanvasPos: Vec2;
        currCanvasPos: Vec2;
        lastCanvasPos: Vec2;
        movementDelta: Vec2;
    } | null;
    private _dragVelocity: Vec2 | null;

    constructor(world: World) {
        super(world);

        this._mapDrag = null;
        this._dragVelocity = null;
    }

    initialise(): void {}

    uninitialse(): void {}

    update() {
        if (this._mapDrag) {
            this._mapDrag.lastCanvasPos = this._mapDrag.currCanvasPos;
        }

        if (this._dragVelocity) {
            this.camera.interpolateByDelta(this._dragVelocity, TrackingSpeed.IMMEDIATE);

            this._dragVelocity = this._dragVelocity.scale(MapModeHandler.DRAG_DAMPING);

            if (this._dragVelocity.length <= 1) {
                this._dragVelocity = null;
            }
        }
    }

    updateDelta(event: MouseEvent | React.MouseEvent, trackingSpeed: TrackingSpeed) {
        if (this._mapDrag) {
            const currPos = ModeHandler.EventToCanvasPos(event);
            const delta = currPos.sub(this._mapDrag.lastCanvasPos);

            this._mapDrag.currCanvasPos = currPos;
            this._mapDrag.movementDelta = delta;

            const totalDifference = currPos.sub(this._mapDrag.baseCanvasPos);
            const newWorldPos = this._mapDrag.worldPos
                .sub(totalDifference)
                .scale(MapModeHandler.MOUSE_SPEED_SCALER);

            this.camera.interpolateToWorldPos(newWorldPos, trackingSpeed);
        }
    }

    isMapDrag(event: MouseEvent | React.MouseEvent): boolean {
        return (event.button === 0 && event.altKey) || event.button === 2;
    }

    startMapDrag(event: MouseEvent | React.MouseEvent): void {
        const baseCanvasPos = ModeHandler.EventToCanvasPos(event);
        const worldPos = this.camera.worldPos;

        this._mapDrag = {
            worldPos,
            baseCanvasPos,
            currCanvasPos: baseCanvasPos,
            lastCanvasPos: baseCanvasPos,
            movementDelta: Vec2.Zero()
        };
        this._dragVelocity = null;
    }

    endMapDrag(event: MouseEvent | React.MouseEvent): void {
        if (this._mapDrag) {
            this.updateDelta(event, TrackingSpeed.FAST);

            this._dragVelocity = this._mapDrag.movementDelta;

            this._mapDrag = null;
        }
    }

    onMouseDown(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        if (this.isMapDrag(event)) {
            this.startMapDrag(event);
        }
    }

    onMouseUp(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        this.endMapDrag(event);
    }

    onMouseMove(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        this.updateDelta(event, TrackingSpeed.VERY_FAST);
        this.trackTile(event);
    }

    onMouseLeave(event: MouseEvent | React.MouseEvent): void {
        this.endMapDrag(event);
    }

    onTileEnter(tilePos: TilePos): void {
        console.info("Entering tile", tilePos);
    }

    onTileLeave(tilePos: TilePos): void {
        console.info("Leaving tile", tilePos);
    }
}
