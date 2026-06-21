import {
    ClientMap,
    ClientToServerMessage,
    FireDetails,
    FireMode,
    FireModeEx,
    FireModeItemSummary,
    FireModeWeaponSummary,
    FireSelector,
    RenderList,
    RenderMode,
    SightType,
    ThrowDetails,
    UnitSummary
} from "@atbs/shared-data";
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
import { MapMode } from "./MapMode";
import { DrawLaserSight, DrawRangeSight } from "./RenderHelpers";
import { FireModeHandler } from "./modeHandlers/FireModeHandler";

export type FireCallback = (details: FireDetails) => void;
export type ThrowCallback = (details: ThrowDetails) => void;

export class World {
    private readonly _camera: Camera2d;
    private readonly _imageCache: ImageCache;
    protected readonly _timer: Timer;
    private _renderMode: RenderMode;
    private _map: ClientMap | null;
    private _mapMode: MapMode;
    private _unit: UnitSummary | null;
    private _unitWeapon: FireModeItemSummary | null;
    private _unitWeaponIndex: number;
    private _interactionHandler: IInteractionHandler | null;
    private _sendMessage: (message: ClientToServerMessage) => void;
    private _mouseCursor: CSSProperties["cursor"];
    private _defaultMouseCursor: CSSProperties["cursor"];

    private _mapModeHandler: MapModeHandler;
    private _fireModeHandler: FireModeHandler;

    private _fireCallback: FireCallback;
    private _throwCallback: ThrowCallback;
    private _fireModeEx: FireModeEx;

    _waitForRenderStart: Promise<void>;
    _renderStarted: (() => void) | null = null;

    constructor(imageCache: ImageCache) {
        this._camera = new Camera2d();
        this._imageCache = imageCache;
        this._timer = new Timer();

        this._renderMode = RenderMode.enum.MAP_MODE;
        this._map = null;
        this._unit = null;
        this._unitWeapon = null;
        this._unitWeaponIndex = 0;

        this._mapMode = MapMode.enum["map-mode"];
        this._mapModeHandler = new MapModeHandler(this);
        this._fireModeHandler = new FireModeHandler(this);
        this._interactionHandler = this._mapModeHandler;
        this._sendMessage = () => {
            throw new Error("World:sendMessage function not set");
        };

        this._waitForRenderStart = new Promise((resolve) => {
            this._renderStarted = resolve;
        });
        this._mouseCursor = undefined;
        this._defaultMouseCursor = undefined;

        this._fireCallback = () => {
            throw new Error("World:fireCallback function not set");
        };
        this._throwCallback = () => {
            throw new Error("World:throwCallback function not set");
        };
        this._fireModeEx = FireModeEx.enum.aimed;
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

    get hasUnit(): boolean {
        return !!this._unit;
    }

    get unit(): UnitSummary {
        if (!this._unit) {
            throw new Error("Unit should not be null");
        }

        return this._unit;
    }

    set unit(value: UnitSummary | null) {
        this._unit = value;
    }

    get unitWorldPos(): Vec2 {
        const { unit } = this;

        return this.tileCenterToWorld(new TilePos(unit.location));
    }

    get hasUnitWeapon(): boolean {
        return !!this._unitWeapon;
    }

    get unitWeapon(): FireModeItemSummary {
        if (!this._unitWeapon) {
            throw new Error("Unit weapon should not be null");
        }

        return this._unitWeapon;
    }

    set unitWeapon(value: FireModeItemSummary | null) {
        this._unitWeapon = value;
        this._unitWeaponIndex = 0;
    }

    get unitWeaponIndex(): number {
        return this._unitWeaponIndex;
    }

    set unitWeaponIndex(value: number) {
        this._unitWeaponIndex = value;
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

    get mapMode(): MapMode {
        return this._mapMode;
    }

    set mapMode(value: MapMode) {
        let renderMode: RenderMode;
        let mouseCursor: CSSProperties["cursor"];
        let interactionHandler: IInteractionHandler;

        switch (value) {
            case MapMode.enum["map-mode"]:
                renderMode = RenderMode.enum.MAP_MODE;
                mouseCursor = undefined;
                interactionHandler = this._mapModeHandler;
                break;

            case MapMode.enum["unit-mode"]:
                renderMode = RenderMode.enum.MAP_MODE;
                mouseCursor = undefined;
                interactionHandler = this._mapModeHandler;
                break;

            case MapMode.enum["fire-mode"]:
                renderMode = RenderMode.enum.FIRE_MODE;
                mouseCursor = "crosshair";
                interactionHandler = this._fireModeHandler;
                break;
        }

        if (this.renderMode !== renderMode) {
            this.renderMode = renderMode;
        }
        if (this.mouseCursor !== mouseCursor) {
            this.mouseCursor = mouseCursor;
        }
        if (this._interactionHandler !== interactionHandler) {
            this._interactionHandler = interactionHandler;
        }
    }

    get mouseCursor(): CSSProperties["cursor"] {
        return this._mouseCursor;
    }

    get defaultMouseCursor(): CSSProperties["cursor"] {
        return this._defaultMouseCursor;
    }

    set mouseCursor(value: CSSProperties["cursor"]) {
        this._mouseCursor = value;
    }

    set defaultMouseCursor(value: CSSProperties["cursor"]) {
        this._defaultMouseCursor = value;
    }

    get sendMessage(): (message: ClientToServerMessage) => void {
        return this._sendMessage;
    }

    set sendMessage(value: (message: ClientToServerMessage) => void) {
        this._sendMessage = value;
    }

    set fireCallback(value: FireCallback) {
        this._fireCallback = value;
    }

    set throwCallback(value: ThrowCallback) {
        this._throwCallback = value;
    }

    get weapon(): FireModeWeaponSummary {
        return this.unitWeapon.weapons[this.unitWeaponIndex];
    }

    get fireSelector(): FireSelector {
        return this.weapon.fireSelector;
    }

    get fireModeEx(): FireModeEx {
        return this._fireModeEx;
    }

    set fireModeEx(value: FireModeEx) {
        this._fireModeEx = value;
    }

    get fireMode(): FireMode {
        const fireModeEx = this.fireModeEx;
        if (fireModeEx === FireModeEx.enum.throw || fireModeEx === FireModeEx.enum.none) {
            throw new Error("Cannot get fireMode because the fireModeEx is throw");
        }

        return fireModeEx;
    }

    throw(worldPos: Vec2) {
        if (!this.unit.itemInUse) {
            throw new Error("Unit has not item in use to throw");
        }

        this._throwCallback({
            unitId: this.unit.id,
            itemId: this.unit.itemInUse.id,
            worldPos: [worldPos.x, worldPos.y]
        });
    }

    singleFire(worldPos: Vec2) {
        this._fireCallback({
            unitId: this.unit.id,
            weaponId: this.weapon.id,
            fireSelector: this.fireSelector,
            fireMode: this.fireMode,
            worldPoses: [[worldPos.x, worldPos.y]],
            triggerHeldTimeInMs: 0
        });
    }

    burstFire(worldPoses: Vec2[]) {
        this._fireCallback({
            unitId: this.unit.id,
            weaponId: this.weapon.id,
            fireSelector: this.fireSelector,
            fireMode: this.fireMode,
            worldPoses: worldPoses.map((worldPos) => [worldPos.x, worldPos.y]),
            triggerHeldTimeInMs: 0
        });
    }

    autoFire(worldPoses: Vec2[], triggerHeldTimeInMs: number) {
        this._fireCallback({
            unitId: this.unit.id,
            weaponId: this.weapon.id,
            fireSelector: this.fireSelector,
            fireMode: this.fireMode,
            worldPoses: worldPoses.map((worldPos) => [worldPos.x, worldPos.y]),
            triggerHeldTimeInMs
        });
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
        const { time, frameDelta } = this._timer.tick();
        const { width, height } = canvas;

        context.clearRect(0, 0, width, height);

        if (!this.hasMap) {
            return;
        }

        canvas.style.cursor = this.mouseCursor ?? this.defaultMouseCursor ?? "default";

        this.camera.viewportDimensions = new Vec2(width, height);

        this.update({ time, frameDelta });

        const { tileSize } = this.map;
        const scale = new Vec2(1, 1);
        const offset = new Vec2(tileSize / 2, tileSize / 2);

        this.renderTerrainAndFurniture(context, tileSize, scale, offset);
        this.renderSight(context, time);

        if (this._renderStarted) {
            this._renderStarted();
            this._renderStarted = null;
        }
    }

    private renderSight(
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        time: number
    ) {
        if (!this.hasUnitWeapon) {
            return;
        }

        const unitPos = this.unitWorldPos;
        const to = this._interactionHandler?.cursorWorldPos;
        const weapon =
            this.unitWeapon.weapons.length > 0
                ? this.unitWeapon.weapons[this.unitWeaponIndex]
                : null;
        if (weapon && to && !Vec2.IsEqual(unitPos, to)) {
            const dir = to.sub(unitPos).normalise();
            const from = unitPos.add(dir.scale(this.unit.collisionRadius));

            if (this.fireModeEx === FireModeEx.enum.throw) {
                DrawRangeSight(this.camera, context, from, to, this.unitWeapon.maxThrowRange);
            } else {
                switch (weapon.sight) {
                    case SightType.enum.iron:
                        break;

                    case SightType.enum.laser:
                        DrawLaserSight(this.camera, context, from, to, time);
                        break;

                    case SightType.enum.optical:
                        break;

                    case SightType.enum.ranged:
                        DrawRangeSight(
                            this.camera,
                            context,
                            from,
                            to,
                            this.weapon.maxRange
                        );
                        break;
                }
            }
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
