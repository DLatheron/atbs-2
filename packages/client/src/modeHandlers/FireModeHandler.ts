import { World } from "../World";
import { TilePos, Vec2 } from "@atbs/maths";
import { ModeHandler } from "./ModeHandler";
import { calcMinimumAmmoUse, FireModeEx, FireSelector, TrackingSpeed } from "@atbs/shared-data";
import { DrawBulletTrajectories, DrawRoundsThatWillBeFired } from "../RenderHelpers";
import { CanvasLoopProps } from "../components";

const TILE_INFO_QUERY_DEBOUNCE_IN_MS = 500;

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
    private _fireSpread: {
        worldPoses: Vec2[];
        startTime: number;
        rpm: number;
        timeBetweenShots: number;
    } | null;

    constructor(world: World) {
        super(world);

        this._mapDrag = null;
        this._tileInfoQuery = {
            tilePos: null,
            timerId: 0
        };
        this._fireSpread = null;
    }

    initialise(): void {}

    uninitialse(): void {}

    update() {
        if (this._mapDrag) {
            this._mapDrag.lastCanvasPos = this._mapDrag.currCanvasPos;
        }

        if (this._fireSpread) {
            const { frameTime } = this.world;
            const triggerHeldTimeInMs = frameTime - this._fireSpread.startTime;
            const shotsThatShouldHaveBeenFired = Math.floor(
                triggerHeldTimeInMs / this._fireSpread.timeBetweenShots
            );
            const ammoUse = calcMinimumAmmoUse(
                this.world.weapon.fireModes,
                this.world.fireSelector
            );
            const ammoAvailable = this.world.weapon.capacity ?? 0;

            while (this._fireSpread.worldPoses.length < shotsThatShouldHaveBeenFired) {
                if (
                    this._fireSpread.worldPoses.length === ammoUse ||
                    this._fireSpread.worldPoses.length === ammoAvailable
                ) {
                    break;
                }

                const { cursorWorldPos } = this;
                this._fireSpread.worldPoses.push(
                    cursorWorldPos ??
                        this._fireSpread.worldPoses[this._fireSpread.worldPoses.length - 1]
                );
            }
        }
    }

    render({ context }: CanvasLoopProps) {
        if (this._fireSpread) {
            const { camera } = this.world;
            const { worldPoses } = this._fireSpread;

            DrawBulletTrajectories(camera, context, this.world.unitWorldPos, worldPoses);

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

            const totalDifference = currPos.sub(this._mapDrag.baseCanvasPos);
            const newWorldPos = this._mapDrag.worldPos
                .sub(totalDifference)
                .scale(FireModeHandler.MOUSE_SPEED_SCALER);

            this.camera.interpolateToWorldPos(newWorldPos, trackingSpeed);
        }
    }

    isMapDrag(event: MouseEvent | React.MouseEvent): boolean {
        return (event.button === 0 && event.altKey) || event.button === 2;
    }

    isSpreadFire(event: MouseEvent | React.MouseEvent): boolean {
        return event.button === 0 && !event.altKey;
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

            this.camera.additionalVelocity = this._mapDrag.movementDelta;

            this._mapDrag = null;
            this.world.mouseCursor = undefined;
        }
    }

    onMouseDown(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        if (this.isMapDrag(event)) {
            this.startMapDrag(event);
        } else {
            if (this.isSpreadFire(event)) {
                const canvasPos = ModeHandler.EventToCanvasPos(event);
                const worldPos = this.camera.canvasToWorld(canvasPos);

                switch (this.world.fireSelector) {
                    case FireSelector.enum.burst:
                        this._fireSpread = {
                            worldPoses: [worldPos],
                            startTime: this.world.frameTime,
                            rpm: this.world.rpm,
                            timeBetweenShots: this.world.timeBetweenShots
                        };
                        break;

                    case FireSelector.enum.auto:
                        this._fireSpread = {
                            worldPoses: [worldPos],
                            startTime: this.world.frameTime,
                            rpm: this.world.rpm,
                            timeBetweenShots: this.world.timeBetweenShots
                        };
                        break;
                }
            }
        }
    }

    onMouseUp(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        this.endMapDrag(event);

        if (this.isSpreadFire(event) && this._fireSpread) {
            switch (this.world.fireSelector) {
                case FireSelector.enum.burst:
                    this.world.burstFire(this._fireSpread.worldPoses);
                    break;

                case FireSelector.enum.auto: {
                    const { frameTime } = this.world;
                    const triggerHeldForMs = frameTime - this._fireSpread.startTime;
                    this.world.autoFire(this._fireSpread.worldPoses, triggerHeldForMs);
                    break;
                }
            }

            this._fireSpread = null;
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
        } else if (this.world.fireSelector === FireSelector.enum.single) {
            const canvasPos = ModeHandler.EventToCanvasPos(event);
            const worldPos = this.camera.canvasToWorld(canvasPos);

            this.world.singleFire(worldPos);
        }
    }

    onDoubleClick(event: MouseEvent | React.MouseEvent): void {
        const canvasPos = ModeHandler.EventToCanvasPos(event);
        const worldPos = this.camera.canvasToWorld(canvasPos);
        const tilePos = this.world.worldToTile(worldPos);

        this.world.sendMessage({
            type: "client:game:tile:click",
            payload: {
                tilePos: [tilePos.col, tilePos.row],
                worldPos: [worldPos.x, worldPos.y]
            }
        });
    }

    private _debounceTileInfoQuery(tilePos: TilePos) {
        const existingTilePos = this._tileInfoQuery.tilePos;

        if (existingTilePos && !TilePos.IsEqual(tilePos, existingTilePos)) {
            this._clearTileInfoQuery();
        }

        this._tileInfoQuery.timerId = window.setTimeout(() => {
            this.world.sendMessage({
                type: "client:game:tile:info",
                payload: { tilePos: [tilePos.col, tilePos.row] }
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
