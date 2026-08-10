import { Logger } from "@atbs/misc";
import { config } from "../config/config.schema.js";
import type { Game } from "./Game.js";
import type { WorldMap } from "./WorldMap.js";
import type { VisibilityPoi } from "./VisibilityPoi.js";
import type { VisibilityViewer } from "./VisibilityViewer.js";
import { InterestMask, ViewerId, VisibilityUpdate } from "@atbs/shared-data";
import { VisibilityRay } from "./VisibilityRay.js";
import {
    Colour,
    DebugGraphic,
    DebugGraphicType,
    Orientation,
    radiansToDegrees,
    TilePos,
    Vec2,
    type IVec2
} from "@atbs/maths";
import { walkGridCells } from "./GridRayTrace.js";

interface VisibilityCacheEntry {
    poi: VisibilityPoi;
    ray: VisibilityRay;
    /** True when the LOS cast result is still valid for the current viewer location. */
    rayValid: boolean;
    /** True when the in-view-cone status is still valid for the current orientation. */
    angleValid: boolean;
    /** Whether the LOS cast currently reaches the POI. */
    hasLos: boolean;
    /** Whether the LOS direction currently lies inside the viewer's view cone. */
    inViewCone: boolean;
    /** True when hasLos && inViewCone — this viewer currently sees the POI. */
    visible: boolean;
}

const IN_CONE_COLOUR = new Colour({ r: 40, g: 220, b: 80, a: 1 });
const OUT_OF_CONE_COLOUR = new Colour({ r: 200, g: 60, b: 60, a: 1 });

function withAlpha(colour: Colour, alpha: number): Colour {
    return new Colour({ r: colour.r, g: colour.g, b: colour.b, a: alpha });
}

/**
 * True when the direction from viewer to target lies within the viewer's view cone.
 * Non-directional / CENTER facing units treat the cone as 360°. Same-tile / zero length is in-cone.
 */
export function isDirectionInViewCone(
    viewerPos: IVec2,
    targetPos: IVec2,
    orientation: Orientation,
    viewAngleInDegrees: number,
    isDirectional: boolean
): boolean {
    if (!isDirectional || orientation === Orientation.CENTER || viewAngleInDegrees >= 360) {
        return true;
    }

    const toTarget = new Vec2(targetPos).sub(viewerPos);
    if (!toTarget.isNonZero()) {
        return true;
    }

    const facing = Vec2.StepInDirection(orientation);
    const absAngleDeg = Math.abs(
        radiansToDegrees(Vec2.AngleBetweenInRadians(facing, toTarget.normalise()))
    );
    return absAngleDeg <= viewAngleInDegrees / 2;
}

export class VisibilityManager {
    static readonly Logger: Logger = new Logger(
        "VisibilityManager",
        config.logLevels?.visibilityManager
    );

    private readonly _game: Game;
    private readonly _pois: Set<VisibilityPoi>;
    private readonly _viewers: Map<ViewerId, VisibilityViewer>;
    private readonly _cache: Map<ViewerId, VisibilityCacheEntry[]>;
    /** Per-POI refcount of visible viewers, keyed by each of those viewers' interest masks. */
    private readonly _poiVisibleByMask: Map<VisibilityPoi, Map<InterestMask, number>>;

    constructor(game: Game) {
        this._game = game;

        this._pois = new Set<VisibilityPoi>();
        this._viewers = new Map<ViewerId, VisibilityViewer>();
        this._cache = new Map<ViewerId, VisibilityCacheEntry[]>();
        this._poiVisibleByMask = new Map<VisibilityPoi, Map<InterestMask, number>>();
    }

    get game(): Game {
        return this._game;
    }

    get map(): WorldMap {
        return this._game.map;
    }

    addPoi(poi: VisibilityPoi): void {
        VisibilityManager.Logger.debug(`Adding POI ${poi.location} to visibility manager`);

        this._pois.add(poi);
    }

    removePoi(poi: VisibilityPoi): void {
        VisibilityManager.Logger.debug(`Removing POI ${poi.location} from visibility manager`);

        this._pois.delete(poi);
        this.removePoiFromCache(poi);
        this._poiVisibleByMask.delete(poi);
    }

    private removePoiFromCache(poi: VisibilityPoi): void {
        for (const [viewerId, cacheLine] of this._cache.entries()) {
            const viewer = this._viewers.get(viewerId);
            for (const entry of cacheLine) {
                if (entry.poi === poi && entry.visible && viewer) {
                    this.adjustPoiMaskVisibility(poi, viewer.interestMasks, -1);
                    entry.visible = false;
                }
            }
            this._cache.set(
                viewerId,
                cacheLine.filter((c) => c.poi !== poi)
            );
        }
    }

    addViewer(viewer: VisibilityViewer): void {
        VisibilityManager.Logger.debug(`Adding viewer ${viewer.id} to visibility manager`);

        this._viewers.set(viewer.id, viewer);
    }

    removeViewer(viewer: VisibilityViewer): void {
        VisibilityManager.Logger.debug(
            `Removing viewer ${viewer.location} from visibility manager`
        );

        const cache = this._cache.get(viewer.id);
        if (cache) {
            for (const entry of cache) {
                if (entry.visible) {
                    this.adjustPoiMaskVisibility(entry.poi, viewer.interestMasks, -1);
                    entry.visible = false;
                }
            }
        }

        this._viewers.delete(viewer.id);

        this.removeViewerFromCache(viewer.id);
    }

    private removeViewerFromCache(viewerId: ViewerId): void {
        this._cache.delete(viewerId);
    }

    private adjustPoiMaskVisibility(
        poi: VisibilityPoi,
        masks: InterestMask[],
        delta: number
    ): void {
        let byMask = this._poiVisibleByMask.get(poi);
        if (!byMask) {
            if (delta <= 0) {
                return;
            }
            byMask = new Map<InterestMask, number>();
            this._poiVisibleByMask.set(poi, byMask);
        }

        for (const mask of masks) {
            const next = (byMask.get(mask) ?? 0) + delta;
            if (next <= 0) {
                byMask.delete(mask);
            } else {
                byMask.set(mask, next);
            }
        }

        if (byMask.size === 0) {
            this._poiVisibleByMask.delete(poi);
        }
    }

    isPoiVisibleForMasks(poi: VisibilityPoi, masks: InterestMask[]): boolean {
        const byMask = this._poiVisibleByMask.get(poi);
        if (!byMask) {
            return false;
        }
        return masks.some((mask) => (byMask.get(mask) ?? 0) > 0);
    }

    /** True when this specific viewer currently sees the POI (direct LOS + view cone). */
    isPoiVisibleToViewer(viewerId: ViewerId, poi: VisibilityPoi): boolean {
        const cache = this._cache.get(viewerId);
        if (!cache) {
            return false;
        }
        return cache.some((entry) => entry.poi === poi && entry.visible);
    }

    private setEntryVisible(
        entry: VisibilityCacheEntry,
        viewer: VisibilityViewer,
        nextVisible: boolean
    ): void {
        if (entry.visible === nextVisible) {
            return;
        }
        this.adjustPoiMaskVisibility(entry.poi, viewer.interestMasks, nextVisible ? 1 : -1);
        entry.visible = nextVisible;
    }

    private recomputeEntryVisible(entry: VisibilityCacheEntry, viewer: VisibilityViewer): void {
        this.setEntryVisible(entry, viewer, entry.hasLos && entry.inViewCone);
    }

    getPois(interestMasks: InterestMask[]): VisibilityPoi[] {
        return [...this._pois.values()].filter((poi) =>
            poi.interestMasks.some((mask) => interestMasks.includes(mask))
        );
    }

    getViewers(interestMasks: InterestMask[]): VisibilityViewer[] {
        return [...this._viewers.values()].filter((viewer) =>
            viewer.interestMasks.some((mask) => interestMasks.includes(mask))
        );
    }

    invalidateViewerLocation(viewerId: ViewerId): void {
        const cache = this.getViewerCache(viewerId);
        for (const entry of cache) {
            entry.rayValid = false;
            entry.angleValid = false;
        }
    }

    /** Rotation changes facing only — invalidate view-cone angle checks, not LOS casts. */
    invalidateViewerOrientation(viewerId: ViewerId): void {
        const cache = this.getViewerCache(viewerId);
        for (const entry of cache) {
            entry.angleValid = false;
        }
    }

    /**
     * Invalidates cached LOS rays for every viewer whose line of sight to a POI
     * passes through `tilePos`, so the next visibility refresh recasts those rays.
     */
    invalidateLocation(tilePos: TilePos): void {
        for (const [viewerId, cache] of this._cache.entries()) {
            const viewer = this._viewers.get(viewerId);
            if (!viewer?.location) {
                continue;
            }

            const srcWorldPos = this.map.tileCenterToWorld(viewer.location);

            for (const entry of cache) {
                if (!entry.rayValid) {
                    continue;
                }

                const dstWorldPos = this.map.tileCenterToWorld(entry.poi.location);
                if (this.rayPassesThroughTile(srcWorldPos, dstWorldPos, tilePos)) {
                    entry.rayValid = false;
                    entry.angleValid = false;
                }
            }
        }
    }

    private rayPassesThroughTile(srcWorldPos: Vec2, dstWorldPos: Vec2, tilePos: TilePos): boolean {
        const grid = { aabb: this.map.worldBounds, gridScale: this.map.tileSize };

        for (const cellWalk of walkGridCells(srcWorldPos, dstWorldPos, grid)) {
            if ("outOfBounds" in cellWalk) {
                return false;
            }

            const walkedTilePos = this.map.worldToTile(
                this.map.worldBounds.topLeft.add(cellWalk.cellOrigin)
            );
            if (TilePos.IsEqual(walkedTilePos, tilePos)) {
                return true;
            }
        }

        return false;
    }

    private getViewerCache(viewerId: ViewerId): VisibilityCacheEntry[] {
        let cache = this._cache.get(viewerId);
        if (!cache) {
            cache = [];
            this._cache.set(viewerId, cache);
        }
        return cache;
    }

    update(viewerId?: ViewerId, debugGraphics?: DebugGraphic[]): void {
        if (viewerId) {
            this._updateUnit(viewerId, debugGraphics);
        } else {
            this._updateAll(debugGraphics);
        }
    }

    private getViewer(viewerId: ViewerId): VisibilityViewer | undefined {
        return this._viewers.get(viewerId);
    }

    private _updateUnit(viewerId: ViewerId, debugGraphics?: DebugGraphic[]): void {
        VisibilityManager.Logger.debug(`Updating visibility for viewer ${viewerId}`);

        const viewer = this.getViewer(viewerId);
        if (!viewer) {
            return;
        }

        this._updateViewer(viewer, debugGraphics);
    }

    private _updateAll(debugGraphics?: DebugGraphic[]): void {
        VisibilityManager.Logger.debug(`Updating visibility`);

        for (const viewer of this._viewers.values()) {
            this._updateViewer(viewer, debugGraphics);
        }
    }

    private _updateViewer(viewer: VisibilityViewer, debugGraphics?: DebugGraphic[]): void {
        const cache = this.getViewerCache(viewer.id);

        if (viewer.location === null) {
            for (const entry of cache) {
                this.setEntryVisible(entry, viewer, false);
            }
            return;
        }

        for (const poi of viewer.pois) {
            const viewerWorldPos = this.map.tileCenterToWorld(viewer.location);
            const poiWorldPos = this.map.tileCenterToWorld(poi.location);

            let entry = cache.find((c) => c.poi === poi);
            let updatedThisPass = false;

            let ray: VisibilityRay;
            if (entry?.rayValid) {
                ray = entry.ray;
            } else {
                ray = new VisibilityRay(viewerWorldPos, poiWorldPos, viewer.visualType);
                const result = this.map.castVisualRay(
                    ray,
                    viewer.visualType,
                    {
                        skipTilePos: viewer.location,
                        targetTilePos: poi.location
                    },
                    debugGraphics
                );
                ray.intersection = result.pos;
                updatedThisPass = true;

                if (entry) {
                    entry.ray = ray;
                    entry.rayValid = true;
                    entry.hasLos = result.visible;
                    // New LOS endpoint — angle vs cone must be recomputed.
                    entry.angleValid = false;
                } else {
                    entry = {
                        poi,
                        ray,
                        rayValid: true,
                        angleValid: false,
                        hasLos: result.visible,
                        inViewCone: false,
                        visible: false
                    };
                    cache.push(entry);
                }
            }

            if (!entry.angleValid) {
                const angleTarget = ray.dstPos;
                entry.inViewCone = isDirectionInViewCone(
                    ray.srcPos,
                    angleTarget,
                    viewer.orientation,
                    viewer.viewAngleInDegrees,
                    viewer.isDirectional
                );
                entry.angleValid = true;
                updatedThisPass = true;
            }

            this.recomputeEntryVisible(entry, viewer);

            if (debugGraphics) {
                this._pushRayDebugGraphics(debugGraphics, ray, entry.inViewCone, updatedThisPass);
            }
        }
    }

    private _pushRayDebugGraphics(
        debugGraphics: DebugGraphic[],
        ray: VisibilityRay,
        inViewCone: boolean,
        updatedThisPass: boolean
    ): void {
        const baseColour = inViewCone ? IN_CONE_COLOUR : OUT_OF_CONE_COLOUR;
        const alpha = updatedThisPass ? 1 : 0.35;
        const strokeColour = withAlpha(baseColour, alpha);
        const dstWorldPos = ray.intersection ?? ray.dstPos;

        debugGraphics.push({
            type: DebugGraphicType.enum.line,
            srcWorldPos: ray.srcPos,
            dstWorldPos,
            strokeColour,
            strokeThickness: updatedThisPass ? 2 : 1,
            ...(updatedThisPass ? {} : { lineDash: [6, 4] })
        });

        debugGraphics.push({
            type: DebugGraphicType.enum.point,
            worldPos: dstWorldPos,
            colour: strokeColour,
            size: updatedThisPass ? 8 : 4
        });
    }

    getVisibleTiles(viewersInterestMasks: InterestMask[]): string[] {
        const allInterestMasks = [...viewersInterestMasks, "items", "vfx"];
        const visibleTiles: string[] = [];

        // Add friendly viewer locations to the visible tiles.
        for (const viewer of this._viewers.values()) {
            if (viewer.location === null) {
                continue;
            }

            if (viewer.interestMasks.some((mask) => viewersInterestMasks.includes(mask))) {
                visibleTiles.push(viewer.location.toString());
            }
        }

        // Add interested POI locations visible to at least one matching viewer.
        for (const poi of this._pois.values()) {
            if (
                poi.interestMasks.some((mask) => allInterestMasks.includes(mask)) &&
                this.isPoiVisibleForMasks(poi, viewersInterestMasks)
            ) {
                visibleTiles.push(poi.location.toString());
            }
        }

        return visibleTiles;
    }

    /**
     * Full visibility snapshot for a side: fog-of-war tiles plus the cone
     * parameters of that side's living viewers (for client view-cone rendering).
     */
    getVisibilityUpdate(viewersInterestMasks: InterestMask[]): VisibilityUpdate {
        const viewers = this.getViewers(viewersInterestMasks)
            .filter((viewer) => viewer.isAlive && viewer.location !== null)
            .map((viewer) => {
                const { location } = viewer;
                // Filtered above; location is non-null for living viewers we send.
                return {
                    location: { col: location!.col, row: location!.row },
                    orientation: viewer.orientation,
                    viewAngleInDegrees: viewer.viewAngleInDegrees,
                    viewRange: viewer.limitedView ? 0 : viewer.viewRange
                };
            });

        return {
            tiles: this.getVisibleTiles(viewersInterestMasks),
            viewers
        };
    }
}
