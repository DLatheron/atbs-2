import { World } from "../World";
import { TilePos, Vec2 } from "@atbs/maths";
import { ModeHandler } from "./ModeHandler";
import {
    FireModeAuto,
    FireModeBurst,
    FireModeEx,
    FireSelector,
    getAutoFireMode,
    getBurstFireMode,
    shotsFired,
    TrackingSpeed
} from "@atbs/shared-data";
import { DrawBulletTrajectory, DrawRoundsThatWillBeFired } from "../RenderHelpers";
import { CanvasLoopProps } from "../components";

const TILE_INFO_QUERY_DEBOUNCE_IN_MS = 500;
const FIRE_MODE_LINGER_TIME_IN_MS = 500;

type HandlerFireMode = typeof FireSelector.enum.burst | typeof FireSelector.enum.auto;

type TrackFire =
    | {
          fireSelector: typeof FireSelector.enum.burst;
          burstFireMode: FireModeBurst;
          worldPoses: Vec2[];
          startTime: number;
          rpm: number;
          trackXShots: number;
          lingerInMs: number;
      }
    | {
          fireSelector: typeof FireSelector.enum.auto;
          autoFireMode: FireModeAuto;
          worldPoses: Vec2[];
          startTime: number;
          rpm: number;
          trackXShots: number;
          lingerInMs: number;
      };

export class FireModeHandler extends ModeHandler {
    private static readonly MOUSE_SPEED_SCALER = 1.0;

    private _mapDrag: {
        worldPos: Vec2;
        baseCanvasPos: Vec2;
        currCanvasPos: Vec2;
        lastCanvasPos: Vec2;
        movementDelta: Vec2;
    } | null;
    private _tileInfoQuery: {
        tilePos: TilePos | null;
        timerId: number;
    };
    private _trackFire: TrackFire | null;

    constructor(world: World) {
        super(world);

        this._mapDrag = null;
        this._tileInfoQuery = {
            tilePos: null,
            timerId: 0
        };
        this._trackFire = null;
    }

    initialise(): void {}

    uninitialse(): void {}

    update({ frameDelta }: { frameDelta: number }) {
        if (this._mapDrag) {
            this._mapDrag.lastCanvasPos = this._mapDrag.currCanvasPos;
        }

        if (this._trackFire) {
            if (this._trackFire.lingerInMs > 0) {
                this._trackFire.lingerInMs = Math.max(this._trackFire.lingerInMs - frameDelta, 0);
                if (this._trackFire.lingerInMs === 0) {
                    switch (this.world.fireSelector) {
                        case FireSelector.enum.burst:
                            this.world.burstFire(this._trackFire.worldPoses);
                            break;

                        case FireSelector.enum.auto: {
                            const { frameTime } = this.world;
                            const triggerHeldForMs = frameTime - this._trackFire.startTime;
                            this.world.autoFire(this._trackFire.worldPoses, triggerHeldForMs);
                            break;
                        }
                    }

                    this._trackFire = null;
                }
            } else {
                this.trackFire(this._trackFire);
            }
        }
    }

    render({ context }: CanvasLoopProps) {
        if (this._trackFire) {
            const { camera } = this.world;
            const { worldPoses } = this._trackFire;

            for (const toWorldPos of this._trackFire.worldPoses) {
                const fromWorldPos = this.world.calcUnitPosOutsideCollision(toWorldPos);

                DrawBulletTrajectory(camera, context, fromWorldPos, toWorldPos);
            }

            DrawRoundsThatWillBeFired(
                this.world.camera,
                context,
                worldPoses[worldPoses.length - 1],
                worldPoses.length
            );
        }
    }

    updateDelta(event: MouseEvent | React.MouseEvent, trackingSpeed: TrackingSpeed) {
        if (this._mapDrag) {
            const currPos = ModeHandler.EventToCanvasPos(event);
            const delta = currPos.sub(this._mapDrag.lastCanvasPos);

            this._mapDrag.currCanvasPos = currPos;
            this._mapDrag.movementDelta = delta;

            const totalDifference = this.camera.canvasDeltaToWorldDelta(
                currPos.sub(this._mapDrag.baseCanvasPos)
            );
            const newWorldPos = this._mapDrag.worldPos
                .sub(totalDifference)
                .scale(FireModeHandler.MOUSE_SPEED_SCALER);

            this.camera.interpolateToWorldPos(newWorldPos, trackingSpeed);
        }
    }

    isStartMapDrag(event: MouseEvent | React.MouseEvent): boolean {
        return (event.button === 0 && event.altKey) || event.button === 2;
    }

    isEndMapDrag(event: MouseEvent | React.MouseEvent): boolean {
        return event.button === 0 || event.button === 2;
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
        this.camera.additionalVelocity = null;
        this.world.mouseCursor = "grabbing";
    }

    endMapDrag(event: MouseEvent | React.MouseEvent): void {
        if (this._mapDrag) {
            this.updateDelta(event, TrackingSpeed.enum.FAST);

            this.camera.additionalVelocity = this.camera.canvasDeltaToWorldDelta(
                this._mapDrag.movementDelta
            );

            this._mapDrag = null;
            this.world.mouseCursor = undefined;
        }
    }

    isStartTrackFire(event: MouseEvent | React.MouseEvent): boolean {
        return event.button === 0 && !event.altKey;
    }

    isEndTrackFire(event: MouseEvent | React.MouseEvent): boolean {
        return (
            event.button === 0 &&
            !event.altKey &&
            this.world.fireSelector === FireSelector.enum.auto
        );
    }

    startTrackFire(event: MouseEvent | React.MouseEvent, fireSelector: HandlerFireMode): void {
        const canvasPos = ModeHandler.EventToCanvasPos(event);
        const worldPos = this.camera.canvasToWorld(canvasPos);

        switch (fireSelector) {
            case FireSelector.enum.burst: {
                const burstFireMode = getBurstFireMode(this.world.weapon.fireModes);

                this._trackFire = {
                    fireSelector,
                    burstFireMode,
                    worldPoses: [worldPos],
                    startTime: this.world.frameTime,
                    rpm: burstFireMode.rpm,
                    trackXShots: burstFireMode.ammoUse,
                    lingerInMs: 0
                };
                break;
            }

            case FireSelector.enum.auto: {
                const autoFireMode = getAutoFireMode(this.world.weapon.fireModes);

                this._trackFire = {
                    fireSelector,
                    autoFireMode,
                    worldPoses: [worldPos],
                    startTime: this.world.frameTime,
                    rpm: autoFireMode.rpm,
                    trackXShots: this.world.weapon.capacity ?? 1,
                    lingerInMs: 0
                };
                break;
            }
        }
    }

    static CalcTriggerHeldInMs(trackFire: TrackFire, frameTime: number): number {
        return frameTime - trackFire.startTime;
    }

    trackFire(trackFire: TrackFire): void {
        const triggerHeldTimeInMs = FireModeHandler.CalcTriggerHeldInMs(
            trackFire,
            this.world.frameTime
        );
        const shotsThatShouldHaveBeenFired = shotsFired(triggerHeldTimeInMs, trackFire.rpm);

        while (
            trackFire.worldPoses.length < trackFire.trackXShots &&
            trackFire.worldPoses.length < shotsThatShouldHaveBeenFired
        ) {
            const { cursorWorldPos } = this;
            trackFire.worldPoses.push(
                cursorWorldPos ?? trackFire.worldPoses[trackFire.worldPoses.length - 1]
            );
        }

        if (trackFire.worldPoses.length === trackFire.trackXShots) {
            this.endTrackFire();
        }
    }

    endTrackFire(): void {
        if (this._trackFire) {
            this._trackFire.lingerInMs = FIRE_MODE_LINGER_TIME_IN_MS;
        }
    }

    onMouseDown(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        if (this.isStartMapDrag(event)) {
            this.startMapDrag(event);
        } else if (this.isStartTrackFire(event)) {
            switch (this.world.fireSelector) {
                case FireSelector.enum.single:
                    // Not started by onMouseDown, see onClick.
                    break;

                case FireSelector.enum.burst:
                case FireSelector.enum.auto:
                    this.startTrackFire(event, this.world.fireSelector);
                    break;
            }
        }
    }

    onMouseUp(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        if (this.isEndMapDrag(event)) {
            this.endMapDrag(event);
        }

        if (this.isEndTrackFire(event)) {
            this.endTrackFire();
        }
    }

    onMouseMove(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        super.onMouseMove(event);

        this.updateDelta(event, TrackingSpeed.enum.VERY_FAST);
        this.trackTile(event);
    }

    onMouseLeave(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        super.onMouseLeave(event);

        this.endMapDrag(event);
        this._clearTileInfoQuery();
    }

    onClick(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        if (this.world.fireModeEx === FireModeEx.enum.throw) {
            const canvasPos = ModeHandler.EventToCanvasPos(event);
            const worldPos = this.camera.canvasToWorld(canvasPos);

            this.world.throw(worldPos);
        } else {
            switch (this.world.fireSelector) {
                case FireSelector.enum.single: {
                    const canvasPos = ModeHandler.EventToCanvasPos(event);
                    const worldPos = this.camera.canvasToWorld(canvasPos);

                    this.world.singleFire(worldPos);
                    break;
                }

                case FireSelector.enum.burst:
                case FireSelector.enum.auto:
                    // Not started by onClick, see onMouseDown.
                    break;
            }
        }
    }

    private _debounceTileInfoQuery(tilePos: TilePos) {
        const existingTilePos = this._tileInfoQuery.tilePos;

        if (existingTilePos && !TilePos.IsEqual(tilePos, existingTilePos)) {
            this._clearTileInfoQuery();
        }

        this._tileInfoQuery.timerId = window.setTimeout(() => {
            this.world.sendMessage({
                type: "client:game:tile:info",
                payload: { tilePos }
            });
        }, TILE_INFO_QUERY_DEBOUNCE_IN_MS);
    }

    private _clearTileInfoQuery() {
        if (this._tileInfoQuery.timerId) {
            clearTimeout(this._tileInfoQuery.timerId);
            this._tileInfoQuery.timerId = 0;
        }
    }

    onTileEnter(tilePos: TilePos): void {
        this._debounceTileInfoQuery(tilePos);
    }

    onTileLeave(/*tilePos: TilePos*/): void {
        this._clearTileInfoQuery();
    }
}
