import {
    ClientMap,
    ClientToServerMessage,
    DeathAnimation,
    FireDetails,
    FireMode,
    FireModeEx,
    FireModeItemSummary,
    FireModeWeaponSummary,
    FireSelector,
    getRpm,
    RenderImage,
    RenderList,
    RenderMode,
    SightType,
    ThrowDetails,
    TimedTileUpdate,
    Tracer,
    HitSpark,
    UnitSummary,
    VisibilityViewerSummary
} from "@atbs/shared-data";
import { Vec2 } from "../../maths/dist/Vec2";
import { CanvasLoopProps } from "./components/CanvasLoop";
import { ITilePos, TilePos } from "../../maths/dist/TilePos";
import { Aabb } from "../../maths/dist/Aabb";
import { Camera2d } from "./Camera2d";
import {
    Colour,
    DebugGraphic,
    DebugGraphicType,
    Orientation,
    OrientationToDegrees,
    OrientationToRadians,
    PathSegment,
    rotateOrientation,
    RotateBy180Degrees
} from "@atbs/maths";
import { ImageCache } from "./ImageCache";
import { Timer } from "./Timer";
import { IInteractionHandler } from "./IInteractionHandler";
import { MapModeHandler } from "./modeHandlers/MapModeHandler";
import { ModeHandler } from "./modeHandlers/ModeHandler";
import { CSSProperties } from "@mui/material";
import { MapMode } from "./MapMode";
import {
    DebugDrawArc,
    DebugDrawBox,
    DebugDrawLine,
    DebugDrawPath,
    DebugDrawPoint,
    DebugDrawText,
    DrawLaserSight,
    DrawProjectile,
    DrawRangeSight,
    DrawViewCone,
    DrawRoundedFeatheredTile
} from "./RenderHelpers";
import { FireModeHandler } from "./modeHandlers/FireModeHandler";
import { applyTimedTileUpdate, preloadTraceImages } from "./mapUpdates.js";
import { AnimationController } from "./AnimationController.js";
import { HitSparkParticles } from "./HitSparkParticles.js";

export type FireCallback = (details: FireDetails) => void;
export type ThrowCallback = (details: ThrowDetails) => void;

export interface RenderPluginUpdateProps {
    time: number;
    frameDelta: number;
    simulationTime: number;
}

export interface RenderPluginRenderProps {
    time: number;
    frameDelta: number;
    simulationTime: number;
    camera: Camera2d;
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

export interface RenderPlugin {
    get name(): string;

    update?: (props: RenderPluginUpdateProps) => boolean;
    render?: (props: RenderPluginRenderProps) => boolean;
}

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
    private _frameTime: number;
    private _renderPlugins: RenderPlugin[];
    private _drawSights: boolean;
    private _debugGraphics: DebugGraphic[] | null;
    private _visibleTiles: Set<string>;
    private _visibilityViewers: VisibilityViewerSummary[];
    private _animationController: AnimationController;

    private _actionMenuRef?: React.RefObject<HTMLDivElement | null>;
    private _actionMenuTilePos?: TilePos;

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
        this._frameTime = 0;
        this._renderPlugins = [];
        this._drawSights = false;
        this._debugGraphics = null;
        this._visibleTiles = new Set<string>();
        this._visibilityViewers = [];
        this._animationController = new AnimationController(imageCache);

        this._actionMenuRef = undefined;
        this._actionMenuTilePos = undefined;
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

    get actionMenuRef() {
        if (!this._actionMenuRef) {
            throw new Error("Action menu ref should not be null");
        }

        return this._actionMenuRef;
    }

    set actionMenuRef(actionMenuRef: React.RefObject<HTMLDivElement | null>) {
        this._actionMenuRef = actionMenuRef;
    }

    get actionMenuTilePos() {
        return this._actionMenuTilePos;
    }

    set actionMenuTilePos(actionMenuTilePos: TilePos | undefined) {
        this._actionMenuTilePos = actionMenuTilePos;
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

        if (value) {
            this.actionMenuTilePos = new TilePos(value.location);
        }
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

        if (this.unitWeaponIndex > (this._unitWeapon?.weapons.length ?? 0)) {
            this._unitWeaponIndex = 0;
        }
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
        switch (value) {
            case RenderMode.enum.FIRE_MODE:
                this._drawSights = true;
                break;

            case RenderMode.enum.MAP_MODE:
            case RenderMode.enum.UI_MODE:
                this._drawSights = false;
                break;
        }

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

    get rpm(): number {
        return getRpm(this.weapon.fireModes, this.fireSelector);
    }

    get frameTime(): number {
        return this._frameTime;
    }

    get debugGraphics(): DebugGraphic[] | null {
        return this._debugGraphics;
    }

    set debugGraphics(value: DebugGraphic[] | null) {
        this._debugGraphics = value;

        // Sort out base time of path segments
        value?.forEach((graphic) => {
            if (graphic.type === DebugGraphicType.enum.path) {
                graphic.segments.forEach((segment: PathSegment) => ({
                    ...segment,
                    time: segment.time + this.frameTime
                }));
            }
        });
    }

    get visibleTiles(): Set<string> {
        return this._visibleTiles;
    }

    set visibleTiles(value: Set<string>) {
        this._visibleTiles = value;
    }

    get visibilityViewers(): VisibilityViewerSummary[] {
        return this._visibilityViewers;
    }

    set visibilityViewers(value: VisibilityViewerSummary[]) {
        this._visibilityViewers = value;
    }

    get animationController(): AnimationController {
        return this._animationController;
    }

    async setTracers(
        tracers: Tracer[],
        tileUpdates: TimedTileUpdate[],
        deaths: DeathAnimation[],
        hitSparks: HitSpark[],
        onMapUpdated: () => void,
        completeCallback: () => void
    ): Promise<void> {
        this._drawSights = false;

        // Nothing in the timeline may start until every sprite it swaps in is
        // decoded, otherwise a replaced tile renders as a gap for the duration of
        // its fetch.
        await preloadTraceImages(this.imageCache, tileUpdates, deaths);

        const tracerTimer = new Timer();
        const hitSparkParticles = new HitSparkParticles();
        const spawnedSparkIndices = new Set<number>();
        let traceFinished = false;

        const appliedUpdateIndices = new Set<number>();

        // Deaths are folded into the tracer timeline. They are played one at a
        // time, in ascending start-time order, each pausing the tracer clock for
        // the duration of its spin animation.
        const deathQueue = [...deaths].sort((a, b) => a.startTimeMs - b.startTimeMs);

        // The tracer clock is paused while a death spin plays (and during the
        // subsequent hold). We rely on the Timer's native pause support (a paused
        // Timer freezes its `time` and resumes seamlessly), and mirror that with
        // a local flag used to guard the update/render logic below. `paused`
        // stays true for the entire spin + hold so tracers, completion, and the
        // next death are all suppressed until the hold elapses.
        let paused = false;
        // `holding` distinguishes the post-spin map-mode linger (dead sprite
        // shown) from the spin itself. During the hold the tracer clock is still
        // paused, so we measure elapsed hold time against `performance.now()`.
        let holding = false;
        let holdStartMs = 0;
        let currentHoldMs = 0;
        let savedRenderMode: RenderMode = this._renderMode;

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const world = this;

        // A death emits two tile updates at the same tilePos: a placeholder
        // (whose render list references the spin animation's instanceId) and a
        // "rest" update (generic-dead). We find the rest update by matching the
        // placeholder's tilePos while excluding the placeholder itself.
        const renderListsContainImageId = (update: TimedTileUpdate, imageId: string): boolean =>
            update.tileByRenderMode[RenderMode.enum.MAP_MODE].some(
                (image: RenderImage) => image.imageId === imageId
            ) ||
            update.tileByRenderMode[RenderMode.enum.FIRE_MODE].some(
                (image: RenderImage) => image.imageId === imageId
            );

        const findRestUpdateIndex = (death: DeathAnimation): number => {
            const placeholderImageId = death.playAnimation.instanceId;
            const placeholderIndex = tileUpdates.findIndex((update) =>
                renderListsContainImageId(update, placeholderImageId)
            );
            if (placeholderIndex < 0) {
                return -1;
            }

            const { tilePos } = tileUpdates[placeholderIndex];
            return tileUpdates.findIndex(
                (update, index) =>
                    index !== placeholderIndex &&
                    TilePos.IsEqual(update.tilePos, tilePos) &&
                    !renderListsContainImageId(update, placeholderImageId)
            );
        };

        // The image cache is deliberately not passed to any applyTimedTileUpdate
        // below: preloadTraceImages already fetched the fresh bytes, so refreshing
        // again here would refetch mid-playback and reintroduce the gap.
        const finish = () => {
            for (let index = 0; index < tileUpdates.length; index++) {
                if (!appliedUpdateIndices.has(index)) {
                    applyTimedTileUpdate(world.map, tileUpdates[index]);
                    appliedUpdateIndices.add(index);
                }
            }

            if (appliedUpdateIndices.size > 0) {
                onMapUpdated();
            }

            world._drawSights = true;
            completeCallback();
        };

        const applyDueTileUpdates = (elapsedMs: number) => {
            if (!tileUpdates.length) {
                return;
            }

            let applied = false;

            for (let index = 0; index < tileUpdates.length; index++) {
                if (appliedUpdateIndices.has(index)) {
                    continue;
                }

                if (tileUpdates[index].timeMs <= elapsedMs) {
                    applyTimedTileUpdate(world.map, tileUpdates[index]);
                    appliedUpdateIndices.add(index);
                    applied = true;
                }
            }

            if (applied) {
                onMapUpdated();
            }
        };

        const beginDeath = (death: DeathAnimation) => {
            // Freeze the tracer timeline so projectiles and tile updates hold
            // while the spin plays out on the (independent) world clock.
            paused = true;
            tracerTimer.pause();

            // Tracers must not draw during the death, so drop into map mode. The
            // server's start tile-update (timed at death.startTimeMs) swaps the
            // unit tile to the anim-death placeholder, which is drawn via the
            // registered animation below.
            savedRenderMode = world.renderMode;
            world.renderMode = RenderMode.enum.MAP_MODE;

            // Locate the "rest" (generic-dead) tile update now, off the frozen
            // tracer clock, so we can reveal the dead sprite the instant the spin
            // completes rather than waiting for the (resumed) timeline to reach it.
            const restUpdateIndex = findRestUpdateIndex(death);

            const onSpinComplete = () => {
                // Reveal the dead unit immediately: apply the rest (generic-dead)
                // tile update and mark it applied so the timeline won't re-apply it.
                if (restUpdateIndex >= 0 && !appliedUpdateIndices.has(restUpdateIndex)) {
                    applyTimedTileUpdate(world.map, tileUpdates[restUpdateIndex]);
                    appliedUpdateIndices.add(restUpdateIndex);
                    onMapUpdated();
                }

                // Drop the spin animation; the tile now renders generic-dead.
                world._animationController.removeAnimation(death.playAnimation.instanceId);

                // Enter the HOLD phase: stay in map mode with the tracer clock
                // still paused so no projectiles draw and no other death/tile
                // update leaks. The hold is timed against performance.now()
                // because the tracer clock is frozen.
                holding = true;
                holdStartMs = performance.now();
                currentHoldMs = death.holdMs;
            };

            // Registering now aligns the animation's world-clock start with this
            // moment; it advances via AnimationController.update regardless of
            // the paused tracer clock.
            world._animationController.newAnimation(death.playAnimation, onSpinComplete);
        };

        const endHold = () => {
            // Restore the pre-death render mode (fire mode during a trace) but
            // keep sights suppressed until the trace fully finishes, to preserve
            // the non-death rendering behaviour.
            world.renderMode = savedRenderMode ?? RenderMode.enum.FIRE_MODE;
            world._drawSights = false;

            tracerTimer.resume();
            paused = false;
            holding = false;

            // Only now advance to the next death, so deaths serialise: the next
            // one cannot begin until this hold has fully elapsed.
            deathQueue.shift();
        };

        const spawnDueHitSparks = (elapsedMs: number) => {
            for (let index = 0; index < hitSparks.length; index++) {
                if (spawnedSparkIndices.has(index)) {
                    continue;
                }

                if (hitSparks[index].timeMs <= elapsedMs) {
                    const spark = hitSparks[index];
                    hitSparkParticles.spawnBurst(
                        spark.pos,
                        spark.colour,
                        spark.direction,
                        spark.count
                    );
                    spawnedSparkIndices.add(index);
                }
            }
        };

        this.addRenderPlugin({
            get name() {
                return "Tracers";
            },

            update({ frameDelta }: RenderPluginUpdateProps) {
                hitSparkParticles.update(frameDelta);

                // While holding on the dead unit, the tracer clock is paused, so
                // measure the linger against the wall clock and resume once it
                // elapses. Nothing else advances until then.
                if (holding) {
                    if (performance.now() - holdStartMs >= currentHoldMs) {
                        endHold();
                    }
                    return false;
                }

                const { time } = tracerTimer.tick();
                const elapsedMs = Math.max(time, 0);

                spawnDueHitSparks(elapsedMs);

                // Kick off the next death once the (unpaused) clock reaches its
                // start time. Only one death is active at a time; the paused
                // clock naturally serialises the remainder.
                if (!paused && deathQueue.length > 0 && deathQueue[0].startTimeMs <= elapsedMs) {
                    beginDeath(deathQueue[0]);
                }

                // Apply tile updates up to the (frozen while paused) elapsed
                // time. This includes the death's start tile-update at the moment
                // the death begins; while paused `elapsedMs` no longer advances,
                // so no later updates leak through.
                applyDueTileUpdates(elapsedMs);

                return false;
            },

            render({ camera, context }: RenderPluginRenderProps) {
                hitSparkParticles.render(camera, context);

                const { time } = tracerTimer;

                // A death spin/hold owns the tracer clock: don't draw projectiles
                // or complete the trace while it plays. `paused` (set in
                // beginDeath, cleared in endHold) is the authoritative "a death is
                // playing" flag, independent of this client's persistent render
                // mode — the observing side stays in map mode yet must still draw
                // tracers and complete the trace to unblock its message queue.
                if (paused) {
                    return traceFinished && hitSparkParticles.isEmpty;
                }

                let allComplete = true;
                for (const tracer of tracers) {
                    if (!DrawProjectile(camera, context, 0, time, tracer)) {
                        allComplete = false;
                    }
                }

                if (allComplete && !traceFinished) {
                    finish();
                    traceFinished = true;
                }

                if (traceFinished && hitSparkParticles.isEmpty) {
                    return true;
                }

                return false;
            }
        });
    }

    addRenderPlugin(renderPlugin: RenderPlugin) {
        this._renderPlugins.push(renderPlugin);
    }

    removeRenderPlugin(renderPlugin: RenderPlugin) {
        this._renderPlugins = this._renderPlugins.filter((plugin) => plugin !== renderPlugin);
    }

    private _updateRenderPlugins(props: RenderPluginUpdateProps) {
        const renderPlugins = [...this._renderPlugins];

        renderPlugins.forEach((plugin) => {
            // console.info("Updating render plugin", plugin.name);
            if (plugin.update?.(props)) {
                // console.info("Removing render plugin after update", plugin.name);
                this.removeRenderPlugin(plugin);
            }
        });
    }

    private _renderRenderPlugins(props: RenderPluginRenderProps) {
        const renderPlugins = [...this._renderPlugins];

        renderPlugins.forEach((plugin) => {
            // console.info("Rendering render plugin", plugin.name);
            if (plugin.render?.(props)) {
                // console.info("Removing render plugin after render", plugin.name);
                this.removeRenderPlugin(plugin);
            }
        });
    }

    throw(worldPos: Vec2) {
        if (!this.unit.itemInUse) {
            throw new Error("Unit has not item in use to throw");
        }

        this._throwCallback({
            unitId: this.unit.id,
            itemId: this.unit.itemInUse.id,
            worldPos
        });
    }

    singleFire(worldPos: Vec2) {
        this._fireCallback({
            unitId: this.unit.id,
            weaponId: this.weapon.id,
            fireSelector: this.fireSelector,
            fireMode: this.fireMode,
            worldPoses: [worldPos],
            triggerHeldTimeInMs: 0
        });
    }

    burstFire(worldPoses: Vec2[]) {
        this._fireCallback({
            unitId: this.unit.id,
            weaponId: this.weapon.id,
            fireSelector: this.fireSelector,
            fireMode: this.fireMode,
            worldPoses: worldPoses.map((worldPos) => worldPos),
            triggerHeldTimeInMs: 0
        });
    }

    autoFire(worldPoses: Vec2[], triggerHeldTimeInMs: number) {
        this._fireCallback({
            unitId: this.unit.id,
            weaponId: this.weapon.id,
            fireSelector: this.fireSelector,
            fireMode: this.fireMode,
            worldPoses: worldPoses.map((worldPos) => worldPos),
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

    tileToWorld(tilePos: ITilePos): Vec2 {
        const { tileSize } = this.map;

        return new Vec2(tilePos.col * tileSize, tilePos.row * tileSize);
    }

    tileCenterToWorld(tilePos: ITilePos): Vec2 {
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
        this._frameTime = time;

        this._animationController.update({ time, frameDelta });

        this.camera.worldBounds = this.worldBounds;

        this._interactionHandler?.update?.({ time, frameDelta });

        this.camera.update({ time, frameDelta });

        const updateProps: RenderPluginUpdateProps = {
            time,
            simulationTime: this._timer.simulationTime,
            frameDelta
        };
        this._updateRenderPlugins(updateProps);
    }

    private _renderUnitViewCones(
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        tileSize: number,
        _scale: Vec2,
        _offset: Vec2,
        colour: Colour
    ) {
        const halfTileSize = tileSize / 2;

        for (const viewer of this._visibilityViewers) {
            const orientation = viewer.orientation as Orientation;
            const tileTopLeft = new TilePos(viewer.location).scale(tileSize);
            const tileCenter = tileTopLeft.add(new Vec2(halfTileSize, halfTileSize));

            const zoom = this.camera.zoom;
            const featherPx = 6 * zoom;
            const cornerRadiusPx = 24 * zoom;
            // Origin the cone at the back of the tile (opposite corner for
            // diagonals, mid-back edge for cardinals) so it opens across the tile
            // toward the facing direction — e.g. SOUTH_WEST → NORTH_EAST corner.
            const backOffset =
                orientation === Orientation.CENTER
                    ? Vec2.Zero()
                    : Vec2.StepInDirection(
                          rotateOrientation(orientation, RotateBy180Degrees)
                      ).scale(halfTileSize - 24);
            const coneWorldPos = tileCenter.add(backOffset);
            const unitAngle = OrientationToDegrees[orientation];

            DrawRoundedFeatheredTile(
                this.camera,
                context,
                tileTopLeft,
                this.camera.worldLengthToCanvas(tileSize),
                colour,
                featherPx,
                cornerRadiusPx
            );

            if (viewer.viewRange > 0) {
                DrawViewCone(
                    this.camera,
                    context,
                    coneWorldPos,
                    this.camera.worldLengthToCanvas(viewer.viewRange),
                    unitAngle,
                    viewer.viewAngleInDegrees,
                    colour
                );
            }
        }
    }

    renderWorld(canvasLoopProps: CanvasLoopProps) {
        if (!this.hasMap) {
            return;
        }

        const { canvas, context, offscreenCanvases, offscreenContexts } = canvasLoopProps;
        const { time, frameDelta } = this._timer.tick();
        const { width, height } = canvas;

        canvas.style.cursor = this.mouseCursor ?? this.defaultMouseCursor ?? "default";

        offscreenCanvases[0].width = width;
        offscreenCanvases[0].height = height;
        offscreenCanvases[1].width = width;
        offscreenCanvases[1].height = height;
        this.camera.viewportDimensions = new Vec2(width, height);

        this.update({ time, frameDelta });

        const { tileSize } = this.map;
        const zoom = this.camera.zoom;
        const scale = new Vec2(zoom, zoom);
        const offset = new Vec2((tileSize * zoom) / 2, (tileSize * zoom) / 2);

        context.clearRect(0, 0, width, height);
        offscreenContexts[0].clearRect(0, 0, width, height);
        offscreenContexts[1].clearRect(0, 0, width, height);

        //
        // Offscreen canvas #0 - What can be seen.
        //
        this._renderUnitViewCones(offscreenContexts[0], tileSize, scale, offset, Colour.White);

        offscreenContexts[0].globalCompositeOperation = "source-atop";
        offscreenContexts[0].fillStyle =
            this.renderMode === RenderMode.enum.MAP_MODE ? "#ffffffff" : "#001000ff";
        offscreenContexts[0].fillRect(0, 0, width, height);

        this.renderTerrainAndFurniture(offscreenContexts[0], tileSize, scale, offset);

        // TODO: Render tracers...
        const renderProps: RenderPluginRenderProps = {
            time,
            frameDelta,
            simulationTime: this._timer.simulationTime,
            camera: this.camera,
            context: offscreenContexts[0]
        };

        this._renderRenderPlugins(renderProps);

        this._interactionHandler?.render?.({
            ...canvasLoopProps,
            context: offscreenContexts[0]
        });

        this.renderSight(renderProps.context, time);

        this._animationController.render({
            camera: this.camera,
            context: renderProps.context
        });

        //
        // Offscreen canvas #1 - What cannot be seen.
        //
        this._renderUnitViewCones(offscreenContexts[1], tileSize, scale, offset, Colour.Black);

        offscreenContexts[1].globalCompositeOperation = "destination-atop";
        offscreenContexts[1].fillStyle =
            this.renderMode === RenderMode.enum.MAP_MODE ? "#ffffff80" : "#80000030";
        offscreenContexts[1].fillRect(0, 0, width, height);
        offscreenContexts[1].globalCompositeOperation = "source-atop";

        this.renderTerrainAndFurniture(offscreenContexts[1], tileSize, scale, offset);

        context.globalCompositeOperation = "source-over";
        context.drawImage(offscreenCanvases[1], 0, 0);
        context.drawImage(offscreenCanvases[0], 0, 0);

        context.globalCompositeOperation = "source-over";

        this._renderDebugGraphics({ ...renderProps, context });

        this._repositionActionMenu();

        if (this._renderStarted) {
            this._renderStarted();
            this._renderStarted = null;
        }
    }

    private _renderDebugGraphics(renderProps: RenderPluginRenderProps) {
        if (!this.debugGraphics) {
            return;
        }

        for (const graphic of this.debugGraphics) {
            switch (graphic.type) {
                case DebugGraphicType.enum.tile:
                    DebugDrawBox(
                        renderProps.camera,
                        renderProps.context,
                        this.tileToWorld(graphic.tilePos),
                        renderProps.camera.worldLengthToCanvas(this.map.tileSize),
                        renderProps.camera.worldLengthToCanvas(this.map.tileSize),
                        graphic.strokeColour,
                        graphic.strokeThickness,
                        graphic.fillColour
                    );
                    break;

                case DebugGraphicType.enum.box:
                    DebugDrawBox(
                        renderProps.camera,
                        renderProps.context,
                        graphic.centerWorldPos,
                        renderProps.camera.worldLengthToCanvas(graphic.width),
                        renderProps.camera.worldLengthToCanvas(graphic.height),
                        graphic.strokeColour,
                        graphic.strokeThickness,
                        graphic.fillColour
                    );
                    break;

                case DebugGraphicType.enum.line:
                    DebugDrawLine(
                        renderProps.camera,
                        renderProps.context,
                        graphic.srcWorldPos,
                        graphic.dstWorldPos,
                        graphic.strokeColour,
                        graphic.strokeThickness,
                        graphic.lineDash
                    );
                    break;

                case DebugGraphicType.enum.path:
                    DebugDrawPath(
                        renderProps.camera,
                        renderProps.context,
                        renderProps.time,
                        graphic.segments,
                        graphic.trail,
                        graphic.strokeColour,
                        graphic.strokeThickness,
                        graphic.lineDash
                    );
                    break;

                case DebugGraphicType.enum.point:
                    DebugDrawPoint(
                        renderProps.camera,
                        renderProps.context,
                        graphic.worldPos,
                        graphic.colour,
                        renderProps.camera.worldLengthToCanvas(graphic.size)
                    );
                    break;

                case DebugGraphicType.enum.arc:
                    DebugDrawArc(
                        renderProps.camera,
                        renderProps.context,
                        graphic.centerWorldPos,
                        renderProps.camera.worldLengthToCanvas(graphic.radius),
                        graphic.startAngleInDegrees,
                        graphic.endAngleInDegrees,
                        graphic.clockwise,
                        graphic.strokeColour,
                        graphic.strokeThickness,
                        graphic.fillColour
                    );
                    break;

                case DebugGraphicType.enum.text:
                    DebugDrawText(
                        renderProps.camera,
                        renderProps.context,
                        graphic.worldPos,
                        graphic.text,
                        graphic.colour,
                        graphic.fontFamily,
                        graphic.fontSize
                    );
                    break;
            }
        }
    }

    calcUnitPosOutsideCollision(to: Vec2): Vec2 {
        const { unitWorldPos } = this;
        if (Vec2.IsEqual(unitWorldPos, to)) {
            return to;
        }

        const dir = to.sub(unitWorldPos).normalise();
        return unitWorldPos.add(dir.scale(this.unit.collisionRadius));
    }

    private renderSight(
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        time: number
    ) {
        if (
            this.renderMode !== RenderMode.enum.FIRE_MODE ||
            !this.hasUnit ||
            !this.hasUnitWeapon ||
            !this._drawSights
        ) {
            return;
        }

        const to = this._interactionHandler?.cursorWorldPos;
        const weapon =
            this.unitWeapon.weapons.length > 0
                ? this.unitWeapon.weapons[this.unitWeaponIndex]
                : null;
        if (weapon && to) {
            const from = this.calcUnitPosOutsideCollision(to);

            if (this.fireModeEx === FireModeEx.enum.throw) {
                DrawRangeSight(this.camera, context, from, to, this.unitWeapon.maxThrowRange);
            } else {
                switch (weapon.sight) {
                    case SightType.enum.iron:
                        break;

                    case SightType.enum.laser: {
                        const rayLength = this.unitWorldPos.sub(to).length;
                        if (rayLength > this.unit.collisionRadius) {
                            DrawLaserSight(this.camera, context, from, to, time);
                        }
                        break;
                    }

                    case SightType.enum.optical:
                        break;

                    case SightType.enum.ranged:
                        DrawRangeSight(this.camera, context, from, to, this.weapon.maxRange);
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
        this.iterateViewportTiles((renderList, tilePos, worldPos) => {
            this.drawRenderList({
                context,
                canvasPos: this.camera.worldToCanvas(worldPos),
                renderList,
                tilePos,
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
        tilePos,
        tileSize,
        scale,
        offset
    }: {
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        canvasPos: Vec2;
        renderList: RenderList;
        tilePos: TilePos;
        tileSize: number;
        scale: Vec2;
        offset: Vec2;
    }): void {
        renderList.forEach(
            ({
                imageId,
                orientation = Orientation.NORTH,
                opacity = 1,
                visibilityFilter = false
            }) => {
                if (imageId.startsWith("anim-")) {
                    const halfTile = (tileSize * scale.x) / 2;
                    this._animationController.renderAnimation(
                        context,
                        imageId,
                        canvasPos.add({ x: halfTile, y: halfTile }),
                        scale.x
                    );
                } else {
                    this.imageCache.requestImage(imageId);
                    if (!this.imageCache.isLoaded(imageId)) {
                        return;
                    }

                    if (visibilityFilter && !this.visibleTiles.has(tilePos.toString())) {
                        return;
                    }

                    this.drawImage({
                        context,
                        canvasPos,
                        image: this.imageCache.getImage(imageId),
                        orientation,
                        opacity,
                        tileSize,
                        scale,
                        offset
                    });
                }
            }
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

    onWheel(event: WheelEvent | React.WheelEvent) {
        if (!this.hasMap) {
            return;
        }

        const canvasPos = ModeHandler.EventToCanvasPos(event);
        this.camera.zoomByWheel(event.deltaY, canvasPos);
    }

    onContextMenu(event: React.MouseEvent) {
        this._interactionHandler?.onContextMenu?.(event);
    }

    _repositionActionMenu() {
        if (this.actionMenuRef && this.actionMenuRef.current) {
            const { map, camera } = this;
            if (map) {
                const { viewportTopLeft } = camera;

                if (this.actionMenuTilePos) {
                    const { col, row } = this.actionMenuTilePos;
                    const canvasPos = {
                        x: col * map.tileSize - viewportTopLeft.x + map.tileSize / 2,
                        y: row * map.tileSize - viewportTopLeft.y + map.tileSize / 2
                    };

                    this.actionMenuRef.current.style.left = `${canvasPos.x}px`;
                    this.actionMenuRef.current.style.top = `${canvasPos.y}px`;
                    this.actionMenuRef.current.style.opacity = "1";
                } else {
                    this.actionMenuRef.current.style.display = "none";
                    this.actionMenuRef.current.style.opacity = "0";
                }
            }
        }
    }

    private static readonly _singleton = new World(ImageCache.GetSingleton());
    static GetSingleton(): World {
        return World._singleton;
    }
}
