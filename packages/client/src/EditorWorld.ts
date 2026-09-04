import { Orientation, TilePos, Vec2, rotateOrientation } from "@atbs/maths";
import {
    ClientMap,
    EditorFurnitureTile,
    EditorMarkersState,
    FurniturePaletteWire,
    ItemPaletteWire,
    RenderList,
    SelectedFurniture,
    SelectedItem,
    SelectedTerrain,
    SelectedWall,
    TerrainPaletteWire,
    TrackingSpeed,
    WallPaletteWire
} from "@atbs/shared-data";
import { ImageCache } from "./ImageCache";
import { World } from "./World";
import { CanvasLoopProps } from "./components/CanvasLoop";
import { ModeHandler } from "./modeHandlers/ModeHandler";
import { drawEditorHoverTileOutline } from "./pages/Editor/editorHoverTileOverlay";
import {
    createDefaultSelectedFurniture,
    getFurnitureBrushSize,
    getFurnitureHoverSize,
    getFurniturePaletteEntryId,
    getPaintRandomiseOrientation as getFurniturePaintRandomiseOrientation,
    rotateFurnitureSelection
} from "./helpers/furnitureHelpers";
import {
    createDefaultSelectedWall,
    getWallId,
    matchWallForTile,
    rotateWallSelection
} from "./helpers/wallHelpers";
import {
    createDefaultSelectedTerrain,
    getPaintOrientation,
    getPaintRandomiseOrientation,
    getTerrainId
} from "./helpers/terrainHelpers";
import { createDefaultSelectedItem, getItemId } from "./helpers/itemHelpers";
import { markersStateToDeploymentSummary, findZoneAtTile } from "./helpers/markerHelpers";

export type EditorPanelMode = "Terrain" | "Furniture" | "Walls" | "Items" | "Markers";

export class EditorWorld extends World {
    private static readonly _singleton = new EditorWorld(ImageCache.GetSingleton());

    private _terrainPalette: TerrainPaletteWire | null = null;
    private _furniturePalette: FurniturePaletteWire | null = null;
    private _wallPalette: WallPaletteWire | null = null;
    private _itemPalette: ItemPaletteWire | null = null;
    private _furnitureLayer: EditorFurnitureTile[][] | null = null;
    private _selectedTerrain: SelectedTerrain = createDefaultSelectedTerrain();
    private _selectedFurniture: SelectedFurniture = createDefaultSelectedFurniture();
    private _selectedWall: SelectedWall = createDefaultSelectedWall();
    private _selectedItem: SelectedItem = createDefaultSelectedItem();
    private _markersState: EditorMarkersState | null = null;
    private _onSelectedWallChange: ((selectedWall: SelectedWall) => void) | null = null;
    private _editorPanel: EditorPanelMode = "Terrain";
    private _paintContext: { lastTilePos?: TilePos } | null = null;
    private _mapDrag: {
        worldPos: Vec2;
        baseCanvasPos: Vec2;
        currCanvasPos: Vec2;
        lastCanvasPos: Vec2;
        movementDelta: Vec2;
        canvas: HTMLCanvasElement;
    } | null = null;
    private _pendingCameraCenter: Vec2 | null = null;
    private _hoverTilePos: TilePos | undefined;
    private _hoverTileSize = new Vec2(1, 1);
    private _hoverTileOrientation = Orientation.NORTH;

    private readonly _onWindowMapDragMove = (event: MouseEvent) => {
        if (!this._mapDrag) {
            return;
        }

        // Right button released outside the canvas (e.g. browser ate mouseup).
        if ((event.buttons & 2) === 0) {
            this._endMapDrag();
            return;
        }

        this._applyMapDragCanvasPos(this._clientToDragCanvasPos(event));
    };

    private readonly _onWindowMapDragUp = (event: MouseEvent) => {
        if (event.button === 2) {
            this._endMapDrag();
        }
    };

    static GetSingleton(): EditorWorld {
        return EditorWorld._singleton;
    }

    get terrainPalette(): TerrainPaletteWire | null {
        return this._terrainPalette;
    }

    set terrainPalette(value: TerrainPaletteWire | null) {
        this._terrainPalette = value;
    }

    get furniturePalette(): FurniturePaletteWire | null {
        return this._furniturePalette;
    }

    set furniturePalette(value: FurniturePaletteWire | null) {
        this._furniturePalette = value;
    }

    get wallPalette(): WallPaletteWire | null {
        return this._wallPalette;
    }

    set wallPalette(value: WallPaletteWire | null) {
        this._wallPalette = value;
    }

    get itemPalette(): ItemPaletteWire | null {
        return this._itemPalette;
    }

    set itemPalette(value: ItemPaletteWire | null) {
        this._itemPalette = value;
    }

    get furnitureLayer(): EditorFurnitureTile[][] | null {
        return this._furnitureLayer;
    }

    set furnitureLayer(value: EditorFurnitureTile[][] | null) {
        this._furnitureLayer = value;
    }

    get selectedTerrain(): SelectedTerrain {
        return this._selectedTerrain;
    }

    set selectedTerrain(value: SelectedTerrain) {
        this._selectedTerrain = value;
    }

    get selectedFurniture(): SelectedFurniture {
        return this._selectedFurniture;
    }

    set selectedFurniture(value: SelectedFurniture) {
        this._selectedFurniture = value;
    }

    get selectedWall(): SelectedWall {
        return this._selectedWall;
    }

    set selectedWall(value: SelectedWall) {
        this._selectedWall = value;
    }

    get selectedItem(): SelectedItem {
        return this._selectedItem;
    }

    set selectedItem(value: SelectedItem) {
        this._selectedItem = value;
    }

    get markersState(): EditorMarkersState | null {
        return this._markersState;
    }

    set markersState(value: EditorMarkersState | null) {
        this._markersState = value;
        this._syncDeploymentMarkersPreview();
    }

    set onSelectedWallChange(callback: ((selectedWall: SelectedWall) => void) | null) {
        this._onSelectedWallChange = callback;
    }

    get editorPanel(): EditorPanelMode {
        return this._editorPanel;
    }

    set editorPanel(value: EditorPanelMode) {
        this._editorPanel = value;
        this._updateHoverTileSize();
        this._syncDeploymentMarkersPreview();
    }

    constructor(imageCache: ImageCache) {
        super(imageCache);
        this._interactionHandler = null;
    }

    set map(value: ClientMap | null) {
        super.map = value;
        if (!value) {
            this._pendingCameraCenter = null;
            return;
        }

        this._pendingCameraCenter = new Vec2(
            (value.width * value.tileSize) / 2,
            (value.height * value.tileSize) / 2
        );
        this._tryApplyPendingCameraCenter();
    }

    get map(): ClientMap {
        return super.map;
    }

    setWallDirection(direction: Orientation | undefined) {
        if (this._selectedWall.direction === direction) {
            return;
        }

        this._selectedWall = {
            ...this._selectedWall,
            direction
        };
        this._notifySelectedWallChange();

        if (this._hoverTilePos) {
            this._updateWallPreview(this._hoverTilePos);
        }
    }

    update({ time, frameDelta }: { time: number; frameDelta: number }) {
        if (this._mapDrag) {
            // Match MapModeHandler: movementDelta is the delta since the last frame.
            this._mapDrag.lastCanvasPos = this._mapDrag.currCanvasPos;
        }

        this._tryApplyPendingCameraCenter();
        super.update({ time, frameDelta });
    }

    renderDeploymentPhase(canvasLoopProps: CanvasLoopProps) {
        super.renderDeploymentPhase(canvasLoopProps);

        if (!this._hoverTilePos || !this.hasMap) {
            return;
        }

        const { context } = canvasLoopProps;
        const { tileSize } = this.map;
        const zoom = this.camera.zoom;
        const scale = new Vec2(zoom, zoom);
        const offset = new Vec2((tileSize * zoom) / 2, (tileSize * zoom) / 2);

        drawEditorHoverTileOutline(
            context,
            this.camera,
            this._hoverTilePos,
            tileSize,
            this._hoverTileSize.x,
            this._hoverTileSize.y,
            scale,
            offset,
            this.frameTime
        );
    }

    drawRenderList(params: {
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        canvasPos: Vec2;
        renderList: RenderList;
        tilePos: TilePos;
        tileSize: number;
        scale: Vec2;
        offset: Vec2;
        deferredAnimations?: Parameters<World["drawRenderList"]>[0]["deferredAnimations"];
        grayscale?: boolean;
    }): void {
        const editorRenderList = params.renderList.map(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ({ visibilityFilter: _visibilityFilter, ...image }) => image
        );

        super.drawRenderList({
            ...params,
            renderList: editorRenderList
        });
    }

    onMouseEnter(event: MouseEvent | React.MouseEvent) {
        if (!this.hasMap) {
            return;
        }

        this._updateHoverTile(event);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onMouseLeave(_event: MouseEvent | React.MouseEvent) {
        this._hoverTilePos = undefined;
    }

    onMouseDown(event: MouseEvent | React.MouseEvent) {
        if (!this.hasMap) {
            return;
        }

        if (this._isMapDrag(event)) {
            this._startMapDrag(event);
            return;
        }

        if (event.button === 0) {
            if (this._editorPanel === "Terrain") {
                this._paintContext = {};
                this._paintTile(event);
            } else if (this._editorPanel === "Furniture") {
                this._paintContext = {};
                this._paintFurniture(event);
            } else if (this._editorPanel === "Walls") {
                this._paintContext = {};
                this._paintWall(event);
            } else if (this._editorPanel === "Items") {
                this._paintContext = {};
                this._paintItem(event);
            } else if (this._editorPanel === "Markers") {
                this._paintContext = {};
                this._paintMarkers(event);
            }
        }
    }

    onMouseUp(event: MouseEvent | React.MouseEvent) {
        if (!this.hasMap) {
            return;
        }

        if (this._isMapDrag(event)) {
            this._endMapDrag();
        }

        this._paintContext = null;
    }

    onMouseMove(event: MouseEvent | React.MouseEvent) {
        if (!this.hasMap) {
            return;
        }

        if (this._mapDrag) {
            this._applyMapDragCanvasPos(this._clientToDragCanvasPos(event));
            return;
        }

        this._updateHoverTile(event);

        if (!this._paintContext) {
            return;
        }

        if (this._editorPanel === "Terrain") {
            this._paintTile(event);
        } else if (this._editorPanel === "Furniture") {
            this._paintFurniture(event);
        } else if (this._editorPanel === "Walls") {
            this._paintWall(event);
        } else if (this._editorPanel === "Items") {
            this._paintItem(event);
        } else if (this._editorPanel === "Markers") {
            this._paintMarkers(event);
        }
    }

    onWheel(event: WheelEvent | React.WheelEvent) {
        super.onWheel(event);
    }

    rotateSelection(steps: -2 | 2) {
        if (this._editorPanel === "Furniture") {
            this._selectedFurniture = rotateFurnitureSelection(this._selectedFurniture, steps);
            this._updateHoverTileSize();
            return;
        }

        if (this._editorPanel === "Walls") {
            this._selectedWall = rotateWallSelection(this._selectedWall, steps);
            this._notifySelectedWallChange();
            return;
        }

        this._selectedTerrain = {
            ...this._selectedTerrain,
            orientation: rotateOrientation(this._selectedTerrain.orientation, steps)
        };
    }

    undo() {
        this.sendMessage({ type: "client:editor:undo", payload: {} });
    }

    redo() {
        this.sendMessage({ type: "client:editor:redo", payload: {} });
    }

    panToTile(tilePos: TilePos) {
        if (!this.hasMap) {
            return;
        }

        const clamped = tilePos.clamp(this.tileBounds);
        this.camera.interpolateToWorldPos(
            this.tileCenterToWorld(clamped),
            TrackingSpeed.enum.IMMEDIATE
        );
    }

    paintAtTile(tilePos: TilePos, options?: { altKey?: boolean }) {
        if (!this.hasMap) {
            return;
        }

        const clamped = tilePos.clamp(this.tileBounds);
        const altKey = options?.altKey ?? false;

        this._hoverTilePos = clamped;
        this._updateWallPreview(clamped);

        switch (this._editorPanel) {
            case "Terrain":
                this._paintTerrainAt(clamped, altKey);
                break;
            case "Furniture":
                this._paintFurnitureAt(clamped, altKey);
                break;
            case "Walls":
                this._paintWallAt(clamped, altKey);
                break;
            case "Items":
                this._paintItemAt(clamped, altKey);
                break;
            case "Markers":
                this._paintMarkersAt(clamped, altKey);
                break;
            default:
                break;
        }
    }

    private _syncDeploymentMarkersPreview() {
        if (this._editorPanel !== "Markers" || !this._markersState) {
            if (this._editorPanel !== "Markers") {
                this.deploymentMarkers = null;
            }
            return;
        }

        this.deploymentMarker = this._markersState.selectedSideId;
        this.imageCache.requestImage(this._markersState.selectedSideId);
        this.deploymentMarkers = markersStateToDeploymentSummary(
            this._markersState,
            this._markersState.selectedSideId
        );
    }

    private _isMapDrag(event: MouseEvent | React.MouseEvent): boolean {
        return event.button === 2;
    }

    private _tryApplyPendingCameraCenter() {
        if (!this._pendingCameraCenter || !this.camera.hasViewportDimensions) {
            return;
        }

        this.camera.worldBounds = this.worldBounds;
        this.camera.setWorldPosImmediate(this._pendingCameraCenter);
        this._pendingCameraCenter = null;
    }

    private _clientToDragCanvasPos(event: MouseEvent | React.MouseEvent): Vec2 {
        const canvas = this._mapDrag?.canvas;
        if (!canvas) {
            return ModeHandler.EventToCanvasPos(event);
        }

        return this._clientToDragCanvasPosForCanvas(event, canvas);
    }

    private _clientToDragCanvasPosForCanvas(
        event: MouseEvent | React.MouseEvent,
        canvas: HTMLCanvasElement
    ): Vec2 {
        const rect = canvas.getBoundingClientRect();
        const cssX = event.clientX - rect.left;
        const cssY = event.clientY - rect.top;

        if (rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0) {
            return new Vec2(cssX, cssY);
        }

        return new Vec2(cssX * (canvas.width / rect.width), cssY * (canvas.height / rect.height));
    }

    private _applyMapDragCanvasPos(currPos: Vec2) {
        if (!this._mapDrag) {
            return;
        }

        this._mapDrag.movementDelta = currPos.sub(this._mapDrag.lastCanvasPos);
        this._mapDrag.currCanvasPos = currPos;
        const totalDifference = this.camera.canvasDeltaToWorldDelta(
            currPos.sub(this._mapDrag.baseCanvasPos)
        );
        const newWorldPos = this._mapDrag.worldPos.sub(totalDifference);
        this.camera.setWorldPosImmediate(newWorldPos);
    }

    private _startMapDrag(event: MouseEvent | React.MouseEvent) {
        const canvas = event.currentTarget;
        if (!(canvas instanceof HTMLCanvasElement)) {
            return;
        }

        const baseCanvasPos = this._clientToDragCanvasPosForCanvas(event, canvas);
        this._mapDrag = {
            // Clone so later camera updates cannot mutate the drag origin.
            worldPos: this.camera.worldPos.clone(),
            baseCanvasPos,
            currCanvasPos: baseCanvasPos,
            lastCanvasPos: baseCanvasPos,
            movementDelta: Vec2.Zero(),
            canvas
        };
        this.camera.clearZoomFocus();
        this.camera.additionalVelocity = null;
        this.mouseCursor = "grabbing";

        window.addEventListener("mousemove", this._onWindowMapDragMove);
        window.addEventListener("mouseup", this._onWindowMapDragUp);
    }

    private _endMapDrag() {
        if (!this._mapDrag) {
            return;
        }

        window.removeEventListener("mousemove", this._onWindowMapDragMove);
        window.removeEventListener("mouseup", this._onWindowMapDragUp);

        const { movementDelta } = this._mapDrag;
        this._mapDrag = null;
        this.mouseCursor = undefined;

        // Keep flinging in the release direction; Camera2d hard-stops at bounds.
        this.camera.additionalVelocity = this.camera.canvasDeltaToWorldDelta(movementDelta);
    }

    private _paintTile(event: MouseEvent | React.MouseEvent) {
        if (!this._terrainPalette || !this._paintContext) {
            return;
        }

        const tilePos = this._getEventTilePos(event);

        if (
            this._paintContext.lastTilePos &&
            TilePos.IsEqual(this._paintContext.lastTilePos, tilePos)
        ) {
            return;
        }

        this._paintContext.lastTilePos = tilePos;
        this._paintTerrainAt(tilePos, event.altKey);
    }

    private _paintTerrainAt(tilePos: TilePos, altKey: boolean) {
        if (!this._terrainPalette) {
            return;
        }

        if (altKey) {
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

    private _paintFurniture(event: MouseEvent | React.MouseEvent) {
        if (!this._furniturePalette || !this._paintContext) {
            return;
        }

        const tilePos = this._getEventHoverTilePos(event);

        if (
            this._paintContext.lastTilePos &&
            TilePos.IsEqual(this._paintContext.lastTilePos, tilePos)
        ) {
            return;
        }

        this._paintContext.lastTilePos = tilePos;

        if (event.altKey) {
            this._paintFurnitureAt(tilePos, true);
            return;
        }

        this._paintFurnitureAt(tilePos, false);
    }

    private _paintFurnitureAt(tilePos: TilePos, altKey: boolean) {
        if (!this._furniturePalette) {
            return;
        }

        const brushSize = getFurnitureBrushSize(this._furniturePalette, this._selectedFurniture);

        if (altKey) {
            this.sendMessage({
                type: "client:editor:furniture:reset",
                payload: {
                    tilePos,
                    brushSize,
                    brushOrientation: this._hoverTileOrientation
                }
            });
            return;
        }

        const furnitureId = getFurniturePaletteEntryId(
            this._furniturePalette,
            this._selectedFurniture
        );
        if (!furnitureId) {
            return;
        }

        this.sendMessage({
            type: "client:editor:furniture:paint",
            payload: {
                tilePos,
                furnitureId,
                brushSize,
                brushOrientation: this._hoverTileOrientation,
                orientation: this._selectedFurniture.orientation,
                randomiseOrientation: getFurniturePaintRandomiseOrientation(
                    this._furniturePalette,
                    this._selectedFurniture
                )
            }
        });
    }

    private _paintWall(event: MouseEvent | React.MouseEvent) {
        if (!this._wallPalette || !this._paintContext) {
            return;
        }

        const tilePos = this._getEventTilePos(event);

        if (
            this._paintContext.lastTilePos &&
            TilePos.IsEqual(this._paintContext.lastTilePos, tilePos)
        ) {
            return;
        }

        this._paintContext.lastTilePos = tilePos;
        this._paintWallAt(tilePos, event.altKey);
    }

    private _paintWallAt(tilePos: TilePos, altKey: boolean) {
        if (!this._wallPalette) {
            return;
        }

        if (altKey) {
            this.sendMessage({
                type: "client:editor:wall:reset",
                payload: { tilePos }
            });
            return;
        }

        const wallId = getWallId(this._wallPalette, this._selectedWall);
        if (!wallId) {
            return;
        }

        this.sendMessage({
            type: "client:editor:wall:paint",
            payload: {
                tilePos,
                wallId,
                orientation: this._selectedWall.orientation,
                autoFit: this._selectedWall.autoFit,
                direction: this._selectedWall.direction
            }
        });
    }

    private _paintItem(event: MouseEvent | React.MouseEvent) {
        if (!this._itemPalette || !this._paintContext) {
            return;
        }

        const tilePos = this._getEventTilePos(event);

        if (
            this._paintContext.lastTilePos &&
            TilePos.IsEqual(this._paintContext.lastTilePos, tilePos)
        ) {
            return;
        }

        this._paintContext.lastTilePos = tilePos;
        this._paintItemAt(tilePos, event.altKey);
    }

    private _paintItemAt(tilePos: TilePos, altKey: boolean) {
        if (!this._itemPalette) {
            return;
        }

        if (altKey) {
            this.sendMessage({
                type: "client:editor:item:reset",
                payload: { tilePos }
            });
            return;
        }

        const itemId = getItemId(this._itemPalette, this._selectedItem);
        if (!itemId) {
            return;
        }

        this.sendMessage({
            type: "client:editor:item:paint",
            payload: {
                tilePos,
                itemId
            }
        });
    }

    private _paintMarkers(event: MouseEvent | React.MouseEvent) {
        if (!this._paintContext) {
            return;
        }

        const tilePos = this._getEventTilePos(event);

        if (
            this._paintContext.lastTilePos &&
            TilePos.IsEqual(this._paintContext.lastTilePos, tilePos)
        ) {
            return;
        }

        this._paintContext.lastTilePos = tilePos;
        this._paintMarkersAt(tilePos, event.altKey);
    }

    private _paintMarkersAt(tilePos: TilePos, altKey: boolean) {
        if (!this._markersState) {
            return;
        }

        if (altKey) {
            if (!this._markersState.selectedZoneId) {
                return;
            }

            this.sendMessage({
                type: "client:editor:markers:remove-tile",
                payload: { tilePos }
            });
            return;
        }

        const owner = findZoneAtTile(this._markersState, tilePos);
        if (owner) {
            if (owner.zoneId !== this._markersState.selectedZoneId) {
                this.sendMessage({
                    type: "client:editor:markers:select-zone",
                    payload: { zoneId: owner.zoneId }
                });
            }
            return;
        }

        if (!this._markersState.selectedZoneId) {
            return;
        }

        this.sendMessage({
            type: "client:editor:markers:add-tile",
            payload: { tilePos }
        });
    }

    private _getEventHoverTilePos(event: MouseEvent | React.MouseEvent): TilePos {
        const canvasPos = ModeHandler.EventToCanvasPos(event);
        const worldPos = this.camera.canvasToWorld(canvasPos);
        const { tileSize } = this.map;
        const hoverTileSize = new Vec2(
            this._hoverTileSize.x * tileSize,
            this._hoverTileSize.y * tileSize
        );
        const widthPx =
            this._hoverTileOrientation === Orientation.NORTH ||
            this._hoverTileOrientation === Orientation.SOUTH
                ? hoverTileSize.x
                : hoverTileSize.y;
        const heightPx =
            this._hoverTileOrientation === Orientation.NORTH ||
            this._hoverTileOrientation === Orientation.SOUTH
                ? hoverTileSize.y
                : hoverTileSize.x;

        const offset = new Vec2((widthPx - tileSize) / 2, (heightPx - tileSize) / 2);

        return this.worldToTile(worldPos.sub(offset));
    }

    private _getEventTilePos(event: MouseEvent | React.MouseEvent): TilePos {
        if (this._editorPanel === "Furniture") {
            return this._getEventHoverTilePos(event);
        }

        const canvasPos = ModeHandler.EventToCanvasPos(event);
        const worldPos = this.camera.canvasToWorld(canvasPos);
        return this.worldToTile(worldPos);
    }

    private _updateHoverTile(event: MouseEvent | React.MouseEvent) {
        if (!this.hasMap) {
            this._hoverTilePos = undefined;
            return;
        }

        const tilePos = this._getEventTilePos(event);

        if (
            tilePos.col < 0 ||
            tilePos.row < 0 ||
            tilePos.col >= this.map.width ||
            tilePos.row >= this.map.height
        ) {
            this._hoverTilePos = undefined;
            return;
        }

        if (!this._hoverTilePos || !TilePos.IsEqual(this._hoverTilePos, tilePos)) {
            this._hoverTilePos = tilePos;
            this._updateWallPreview(tilePos);
        }
    }

    private _updateWallPreview(tilePos: TilePos) {
        if (
            this._editorPanel !== "Walls" ||
            !this._selectedWall.autoFit ||
            !this._wallPalette ||
            !this._furnitureLayer
        ) {
            return;
        }

        const matched = matchWallForTile(
            this._wallPalette,
            this._furnitureLayer,
            tilePos,
            this._selectedWall
        );

        if (
            matched.index === this._selectedWall.index &&
            matched.orientation === this._selectedWall.orientation
        ) {
            return;
        }

        this._selectedWall = matched;
        this._notifySelectedWallChange();
    }

    private _notifySelectedWallChange() {
        this._onSelectedWallChange?.(this._selectedWall);
    }

    private _updateHoverTileSize() {
        if (this._editorPanel === "Furniture" && this._furniturePalette) {
            this._hoverTileSize = getFurnitureHoverSize(
                this._furniturePalette,
                this._selectedFurniture
            );
            this._hoverTileOrientation = this._selectedFurniture.orientation;
            return;
        }

        this._hoverTileSize = new Vec2(1, 1);
        this._hoverTileOrientation = Orientation.NORTH;
    }

    syncEditorState() {
        this._updateHoverTileSize();
    }
}
