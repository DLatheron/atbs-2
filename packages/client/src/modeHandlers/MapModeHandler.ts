import { World } from "../World";
import { TilePos, Vec2 } from "@atbs/maths";
import { ModeHandler } from "./ModeHandler";
import { TrackingSpeed } from "@atbs/shared-data";

const TILE_INFO_QUERY_DEBOUNCE_IN_MS = 500;

export class MapModeHandler extends ModeHandler {
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

    constructor(world: World) {
        super(world);

        this._mapDrag = null;
        this._tileInfoQuery = {
            tilePos: null,
            timerId: 0
        };
    }

    initialise(): void {}

    uninitialse(): void {}

    update() {
        if (this._mapDrag) {
            this._mapDrag.lastCanvasPos = this._mapDrag.currCanvasPos;
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
        this.camera.additionalVelocity = null;
    }

    endMapDrag(event: MouseEvent | React.MouseEvent): void {
        if (this._mapDrag) {
            this.updateDelta(event, TrackingSpeed.enum.FAST);

            this.camera.additionalVelocity = this._mapDrag.movementDelta;

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

        this.updateDelta(event, TrackingSpeed.enum.VERY_FAST);
        this.trackTile(event);
    }

    onMouseLeave(event: MouseEvent | React.MouseEvent): void {
        this.endMapDrag(event);
        this._clearTileInfoQuery();
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
