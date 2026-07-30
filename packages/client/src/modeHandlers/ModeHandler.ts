import { ClientMap } from "@atbs/shared-data";
import { IInteractionHandler } from "../IInteractionHandler";
import { World } from "../World";
import { Camera2d } from "../Camera2d";
import { TilePos, Vec2 } from "@atbs/maths";

export abstract class ModeHandler implements IInteractionHandler {
    private _world: World;

    private _trackTiles: boolean;
    private _lastTilePos: TilePos | null;
    private _cursorWorldPos: Vec2 | null;

    constructor(world: World, trackTiles: boolean = true) {
        this._world = world;

        this._trackTiles = trackTiles;
        this._lastTilePos = null;
        this._cursorWorldPos = null;
    }

    get world(): World {
        return this._world;
    }

    get map(): ClientMap {
        return this._world.map;
    }

    get camera(): Camera2d {
        return this._world.camera;
    }

    get trackTiles(): boolean {
        return this._trackTiles;
    }

    set trackTiles(value: boolean) {
        this._trackTiles = value;
    }

    get cursorWorldPos(): Vec2 | null {
        return this._cursorWorldPos;
    }

    static EventToCanvasPos(
        event: MouseEvent | WheelEvent | React.MouseEvent | React.WheelEvent
    ): Vec2 {
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        return new Vec2(event.clientX - rect.x, event.clientY - rect.y);
    }

    abstract initialise(): void;
    abstract uninitialse(): void;

    onMouseMove(event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        const canvasPos = ModeHandler.EventToCanvasPos(event);
        const worldPos = this.camera.canvasToWorld(canvasPos);

        this._cursorWorldPos = worldPos;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onMouseLeave(_event: MouseEvent | React.MouseEvent): void {
        if (!this.world.hasMap) {
            return;
        }

        this._cursorWorldPos = null;
    }

    trackTile(event: MouseEvent | React.MouseEvent): void {
        const canvasPos = ModeHandler.EventToCanvasPos(event);
        const worldPos = this.camera.canvasToWorld(canvasPos);
        const tilePos = this.world.worldToTile(worldPos);

        const hasChangedTiles =
            this._lastTilePos === null || !TilePos.IsEqual(tilePos, this._lastTilePos);
        if (hasChangedTiles) {
            if (this._lastTilePos) {
                (this as IInteractionHandler).onTileLeave?.(this._lastTilePos);
            }
            (this as IInteractionHandler).onTileEnter?.(tilePos);

            this._lastTilePos = tilePos;
        }
    }
}
