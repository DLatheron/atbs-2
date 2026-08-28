import { TilePos, Vec2 } from "@atbs/maths";
import { SelectedTerrain, TerrainPaletteWire, TrackingSpeed } from "@atbs/shared-data";
import { ImageCache } from "./ImageCache";
import { World } from "./World";
import { ModeHandler } from "./modeHandlers/ModeHandler";
import {
    createDefaultSelectedTerrain,
    getPaintOrientation,
    getPaintRandomiseOrientation,
    getTerrainId
} from "./helpers/terrainHelpers";

export class EditorWorld extends World {
    private static readonly _singleton = new EditorWorld(ImageCache.GetSingleton());

    private _terrainPalette: TerrainPaletteWire | null = null;
    private _selectedTerrain: SelectedTerrain = createDefaultSelectedTerrain();
    private _terrainModeActive = true;
    private _paintContext: { lastTilePos?: TilePos } | null = null;
    private _mapDrag: {
        worldPos: Vec2;
        baseCanvasPos: Vec2;
        currCanvasPos: Vec2;
        lastCanvasPos: Vec2;
        movementDelta: Vec2;
    } | null = null;

    static GetSingleton(): EditorWorld {
        return EditorWorld._singleton;
    }

    get terrainPalette(): TerrainPaletteWire | null {
        return this._terrainPalette;
    }

    set terrainPalette(value: TerrainPaletteWire | null) {
        this._terrainPalette = value;
    }

    get selectedTerrain(): SelectedTerrain {
        return this._selectedTerrain;
    }

    set selectedTerrain(value: SelectedTerrain) {
        this._selectedTerrain = value;
    }

    get terrainModeActive(): boolean {
        return this._terrainModeActive;
    }

    set terrainModeActive(value: boolean) {
        this._terrainModeActive = value;
    }

    constructor(imageCache: ImageCache) {
        super(imageCache);
        this._interactionHandler = null;
    }

    updateFrame({ time, frameDelta }: { time: number; frameDelta: number }) {
        if (this._mapDrag) {
            this._mapDrag.lastCanvasPos = this._mapDrag.currCanvasPos;
        }

        this.camera.worldBounds = this.worldBounds;
        this.camera.update({ time, frameDelta });
    }

    onMouseDown(event: MouseEvent | React.MouseEvent) {
        if (!this.hasMap) {
            return;
        }

        if (this._isMapDrag(event)) {
            this._startMapDrag(event);
            return;
        }

        if (event.button === 0 && this._terrainModeActive) {
            this._paintContext = {};
            this._paintTile(event);
        }
    }

    onMouseUp(event: MouseEvent | React.MouseEvent) {
        if (!this.hasMap) {
            return;
        }

        if (this._isMapDrag(event)) {
            this._endMapDrag(event);
        }

        this._paintContext = null;
    }

    onMouseMove(event: MouseEvent | React.MouseEvent) {
        if (!this.hasMap) {
            return;
        }

        if (this._mapDrag) {
            this._updateMapDrag(event);
            return;
        }

        if (this._paintContext && this._terrainModeActive) {
            this._paintTile(event);
        }
    }

    onWheel(event: WheelEvent | React.WheelEvent) {
        super.onWheel(event);
    }

    undo() {
        this.sendMessage({ type: "client:editor:undo", payload: {} });
    }

    redo() {
        this.sendMessage({ type: "client:editor:redo", payload: {} });
    }

    private _isMapDrag(event: MouseEvent | React.MouseEvent): boolean {
        return event.button === 2;
    }

    private _startMapDrag(event: MouseEvent | React.MouseEvent) {
        const baseCanvasPos = ModeHandler.EventToCanvasPos(event);
        this._mapDrag = {
            worldPos: this.camera.worldPos,
            baseCanvasPos,
            currCanvasPos: baseCanvasPos,
            lastCanvasPos: baseCanvasPos,
            movementDelta: Vec2.Zero()
        };
        this.camera.additionalVelocity = null;
        this.mouseCursor = "grabbing";
    }

    private _endMapDrag(event: MouseEvent | React.MouseEvent) {
        if (!this._mapDrag) {
            return;
        }

        this._updateMapDrag(event, TrackingSpeed.enum.FAST);
        this.camera.additionalVelocity = this.camera.canvasDeltaToWorldDelta(
            this._mapDrag.movementDelta
        );
        this._mapDrag = null;
        this.mouseCursor = undefined;
    }

    private _updateMapDrag(
        event: MouseEvent | React.MouseEvent,
        trackingSpeed: (typeof TrackingSpeed.enum)[keyof typeof TrackingSpeed.enum] = TrackingSpeed
            .enum.VERY_FAST
    ) {
        if (!this._mapDrag) {
            return;
        }

        const currPos = ModeHandler.EventToCanvasPos(event);
        const delta = currPos.sub(this._mapDrag.lastCanvasPos);
        this._mapDrag.currCanvasPos = currPos;
        this._mapDrag.movementDelta = delta;

        const totalDifference = this.camera.canvasDeltaToWorldDelta(
            currPos.sub(this._mapDrag.baseCanvasPos)
        );
        const newWorldPos = this._mapDrag.worldPos.sub(totalDifference);
        this.camera.interpolateToWorldPos(newWorldPos, trackingSpeed);
    }

    private _paintTile(event: MouseEvent | React.MouseEvent) {
        if (!this._terrainPalette || !this._paintContext) {
            return;
        }

        const canvasPos = ModeHandler.EventToCanvasPos(event);
        const worldPos = this.camera.canvasToWorld(canvasPos);
        const tilePos = this.worldToTile(worldPos);

        if (
            this._paintContext.lastTilePos &&
            TilePos.IsEqual(this._paintContext.lastTilePos, tilePos)
        ) {
            return;
        }

        this._paintContext.lastTilePos = tilePos;

        if (event.altKey) {
            this.sendMessage({
                type: "client:editor:terrain:reset",
                payload: { tilePos }
            });
            return;
        }

        const terrainId = getTerrainId(this._terrainPalette, this._selectedTerrain);
        if (!terrainId) {
            return;
        }

        this.sendMessage({
            type: "client:editor:terrain:paint",
            payload: {
                tilePos,
                terrainId,
                orientation: getPaintOrientation(this._selectedTerrain),
                randomiseOrientation: getPaintRandomiseOrientation(
                    this._terrainPalette,
                    this._selectedTerrain
                )
            }
        });
    }
}
