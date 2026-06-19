import { ClientMap, ClientToServerMessage, RenderList, RenderMode } from "@atbs/shared-data";
import { Vec2 } from "../../maths/dist/Vec2";
import { CanvasLoopProps } from "./components/CanvasLoop";
import { TilePos } from "../../maths/dist/TilePos";
import { Aabb } from "../../maths/dist/Aabb";
import { Camera2d } from "./Camera2d";
import { Orientation, OrientationToRadians } from "@atbs/maths";
import { ImageCache } from "./ImageCache";
import { Timer } from "./Timer";
import { IInteractionHandler } from "./IInteractionHandler";
import { MapModeHandler } from "./modeHandlers/MapModeHandler";
import { ModeHandler } from "./modeHandlers/ModeHandler";
import { CSSProperties } from "@mui/material";

export class World {
    private readonly _camera: Camera2d;
    private readonly _imageCache: ImageCache;
    protected readonly _timer: Timer;
    private _renderMode: RenderMode;
    private _map: ClientMap | null;
    private _interactionHandler: IInteractionHandler | null;
    private _sendMessage: (message: ClientToServerMessage) => void;
    private _mouseCursorStack: CSSProperties["cursor"][];

    _waitForRenderStart: Promise<void>;
    _renderStarted: (() => void) | null = null;

    constructor(imageCache: ImageCache) {
        this._camera = new Camera2d();
        this._imageCache = imageCache;
        this._timer = new Timer();

        this._renderMode = RenderMode.enum.MAP_MODE;
        this._map = null;
        this._interactionHandler = new MapModeHandler(this);
        this._sendMessage = () => {
            throw new Error("World:sendMessage function not set");
        };

        this._waitForRenderStart = new Promise((resolve) => {
            this._renderStarted = resolve;
        });
        this._mouseCursorStack = [];
    }

    get hasMap(): boolean {
        return !!this._map;
    }

    get map(): ClientMap {
        if (!this._map) {
            throw new Error("Map should not be null");
        }

        return this._map;
    }

    set map(value: ClientMap | null) {
        this._map = value;
    }

    get camera(): Camera2d {
        return this._camera;
    }

    get tileBounds() {
        return new Aabb(0, 0, this.map.width, this.map.height);
    }
    get worldBounds() {
        return new Aabb(
            0,
            0,
            this.map.width * this.map.tileSize,
            this.map.height * this.map.tileSize
        );
    }

    get renderMode(): RenderMode {
        return this._renderMode;
    }

    set renderMode(value: RenderMode) {
        this._renderMode = value;
    }

    get imageCache(): ImageCache {
        return this._imageCache;
    }

    pushMouseCursor(value: CSSProperties["cursor"]) {
        this._mouseCursorStack.push(value);
    }

    popMouseCursor() {
        this._mouseCursorStack.pop();
    }

    get sendMessage(): (message: ClientToServerMessage) => void {
        return this._sendMessage;
    }

    set sendMessage(value: (message: ClientToServerMessage) => void) {
        this._sendMessage = value;
    }

    getAt(renderMode: RenderMode, tilePos: TilePos): RenderList {
        const { width, height } = this.map;

        if (
            tilePos.row < 0 ||
            tilePos.row > height - 1 ||
            tilePos.col < 0 ||
            tilePos.col > width - 1
        ) {
            return [];
        }

        if (renderMode === RenderMode.enum.MAP_MODE) {
            return this.map.tilesByRenderMode[RenderMode.enum.MAP_MODE][tilePos.row][tilePos.col];
        } else {
            return this.map.tilesByRenderMode[RenderMode.enum.FIRE_MODE][tilePos.row][tilePos.col];
        }
    }

    worldToTile(worldPos: Vec2): TilePos {
        const { tileSize } = this.map;

        return new TilePos(Math.floor(worldPos.x / tileSize), Math.floor(worldPos.y / tileSize));
    }

    worldToTileUpper(worldPos: Vec2): TilePos {
        const { tileSize } = this.map;

        return new TilePos(Math.ceil(worldPos.x / tileSize), Math.ceil(worldPos.y / tileSize));
    }

    tileToWorld(tilePos: TilePos): Vec2 {
        const { tileSize } = this.map;

        return new Vec2(tilePos.col * tileSize, tilePos.row * tileSize);
    }

    tileCenterToWorld(tilePos: TilePos): Vec2 {
        const { tileSize } = this.map;
        const halfTileSize = tileSize / 2;

        return new Vec2(
            tilePos.col * tileSize + halfTileSize,
            tilePos.row * tileSize + halfTileSize
        );
    }

    viewportInTileStartAndEnd() {
        return {
            start: this.worldToTile(this.camera.viewportTopLeft).clamp(this.tileBounds),
            end: this.worldToTileUpper(this.camera.viewportBottomRight).clamp(this.tileBounds)
        };
    }

    update({ time, frameDelta }: { time: number; frameDelta: number }) {
        this.camera.worldBounds = this.worldBounds;

        this._interactionHandler?.update?.({ time, frameDelta });

        this.camera.update({ time, frameDelta });
    }

    renderWorld({ canvas, context }: CanvasLoopProps) {
        const { time, frameDelta } = this._timer;
        const { width, height } = canvas;

        context.clearRect(0, 0, width, height);

        if (!this.hasMap) {
            return;
        }

        canvas.style.cursor = this._mouseCursorStack[0] ?? "default";

        this.camera.viewportDimensions = new Vec2(width, height);

        this.update({ time, frameDelta });

        const { tileSize } = this.map;
        const scale = new Vec2(1, 1);
        const offset = new Vec2(tileSize / 2, tileSize / 2);

        this.renderTerrainAndFurniture(context, tileSize, scale, offset);

        if (this._renderStarted) {
            this._renderStarted();
            this._renderStarted = null;
        }
    }

    iterateViewportTiles(
        tileRenderFn: (renderList: RenderList, tilePos: TilePos, worldPos: Vec2) => void
    ) {
        // Determine the tiles that intersect with the viewport.
        const viewportTiles = this.viewportInTileStartAndEnd();
        const { tileSize } = this.map;

        for (let col = viewportTiles.start.col; col <= viewportTiles.end.col; ++col) {
            for (let row = viewportTiles.start.row; row <= viewportTiles.end.row; ++row) {
                const tilePos = new TilePos(col, row);
                const tile = this.getAt(this.renderMode, tilePos);
                if (tile) {
                    tileRenderFn(tile, tilePos, new Vec2(col * tileSize, row * tileSize));
                }
            }
        }
    }

    renderTerrainAndFurniture(
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        tileSize: number,
        scale: Vec2,
        offset: Vec2
    ) {
        this.iterateViewportTiles((renderList, _tilePos, worldPos) => {
            this.drawRenderList({
                context,
                canvasPos: this.camera.worldToCanvas(worldPos),
                renderList,
                tileSize,
                scale,
                offset
            });
        });
    }

    drawRenderList({
        context,
        canvasPos,
        renderList,
        tileSize,
        scale,
        offset
    }: {
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        canvasPos: Vec2;
        renderList: RenderList;
        tileSize: number;
        scale: Vec2;
        offset: Vec2;
    }): void {
        renderList.forEach(({ imageId, orientation = Orientation.NORTH, opacity = 1 }) =>
            this.drawImage({
                context,
                canvasPos,
                image: this.imageCache.getImage(imageId),
                orientation,
                opacity,
                tileSize,
                scale,
                offset
            })
        );
    }

    drawImage({
        context,
        canvasPos,
        image,
        orientation,
        tileSize,
        scale,
        offset
    }: {
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        canvasPos: Vec2;
        image: CanvasImageSource;
        orientation: Orientation;
        opacity: number;
        tileSize: number;
        scale: Vec2;
        offset: Vec2;
    }): void {
        const angleInRadians = OrientationToRadians[orientation];

        context.translate(canvasPos.x + offset.x, canvasPos.y + offset.y);
        context.rotate(angleInRadians);
        context.drawImage(
            image,
            0,
            0,
            tileSize,
            tileSize,
            -((tileSize * scale.x) / 2),
            -((tileSize * scale.y) / 2),
            tileSize * scale.x + 1,
            tileSize * scale.y + 1
        );
        context.rotate(-angleInRadians);
        context.translate(-(canvasPos.x + offset.x), -(canvasPos.y + offset.y));
    }

    onMouseEnter(event: MouseEvent | React.MouseEvent) {
        this._interactionHandler?.onMouseEnter?.(event);
    }

    onMouseLeave(event: MouseEvent | React.MouseEvent) {
        this._interactionHandler?.onMouseLeave?.(event);
    }

    onMouseMove(event: MouseEvent | React.MouseEvent) {
        this._interactionHandler?.onMouseMove?.(event);
    }

    onMouseUp(event: MouseEvent | React.MouseEvent) {
        this._interactionHandler?.onMouseUp?.(event);
    }

    onMouseDown(event: MouseEvent | React.MouseEvent) {
        this._interactionHandler?.onMouseDown?.(event);
    }

    onClick(event: MouseEvent | React.MouseEvent) {
        this._interactionHandler?.onClick?.(event);

        const canvasPos = ModeHandler.EventToCanvasPos(event);
        const worldPos = this.camera.canvasToWorld(canvasPos);

        this._interactionHandler?.onClickWorldPos?.(worldPos);

        const tilePos = this.worldToTile(worldPos);
        this._interactionHandler?.onClickTilePos?.(tilePos);
    }

    onDoubleClick(event: MouseEvent | React.MouseEvent) {
        this._interactionHandler?.onDoubleClick?.(event);
    }

    onContextMenu(event: React.MouseEvent) {
        this._interactionHandler?.onContextMenu?.(event);
    }

    private static readonly _singleton = new World(ImageCache.GetSingleton());
    static GetSingleton(): World {
        return World._singleton;
    }
}
