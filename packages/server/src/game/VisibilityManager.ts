import { Logger } from "@atbs/misc";
import { config } from "../config/config.schema.js";
import type { Game } from "./Game.js";
import type { WorldMap } from "./WorldMap.js";
import type { VisibilityPoi } from "./VisibilityPoi.js";
import type { VisibilityViewer } from "./VisibilityViewer.js";
import { InterestMask } from "@atbs/shared-data";
import { VisibilityRay } from "./VisibilityRay.js";
import type { Vec2 } from "@atbs/maths";

interface VisibilityCacheEntry {
    poi: VisibilityPoi;
    ray: VisibilityRay;
    intersection: Vec2 | undefined;
    invalidRay: boolean;
    invalidAngle: boolean;
}

export class VisibilityManager {
    static readonly Logger: Logger = new Logger(
        "VisibilityManager",
        config.logLevels?.visibilityManager
    );

    private readonly _game: Game;
    private readonly _pois: Set<VisibilityPoi>;
    private readonly _viewers: Set<VisibilityViewer>;
    private readonly _cache: Map<VisibilityViewer, VisibilityCacheEntry[]>;

    constructor(game: Game) {
        this._game = game;

        this._pois = new Set<VisibilityPoi>();
        this._viewers = new Set<VisibilityViewer>();
        this._cache = new Map<VisibilityViewer, VisibilityCacheEntry[]>();
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
    }

    private removePoiFromCache(poi: VisibilityPoi): void {
        for (const [viewer, cacheLine] of this._cache.entries()) {
            this._cache.set(
                viewer,
                cacheLine.filter((c) => c.poi !== poi)
            );
        }
    }

    addViewer(viewer: VisibilityViewer): void {
        VisibilityManager.Logger.debug(`Adding viewer ${viewer.id} to visibility manager`);

        this._viewers.add(viewer);
    }

    removeViewer(viewer: VisibilityViewer): void {
        VisibilityManager.Logger.debug(`Removing viewer ${viewer.location} from visibility manager`);

        this._viewers.delete(viewer);

        this.removeViewerFromCache(viewer);
    }

    private removeViewerFromCache(viewer: VisibilityViewer): void {
        this._cache.delete(viewer);
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

    private getViewerCache(viewer: VisibilityViewer): VisibilityCacheEntry[] {
        let cache = this._cache.get(viewer);
        if (!cache) {
            cache = [];
            this._cache.set(viewer, cache);
        }
        return cache;
    }

    update(): void {
        VisibilityManager.Logger.debug(`Updating visibility`);

        for (const viewer of this._viewers) {
            const cache = this.getViewerCache(viewer);

            for (const poi of viewer.pois) {
                if (viewer.location === null) {
                    continue;
                }

                const viewerWorldPos = this.map.tileCenterToWorld(viewer.location);
                const poiWorldPos = this.map.tileCenterToWorld(poi.location);

                let ray = cache.find((c) => c.poi === poi)?.ray;
                if (!ray) {
                    ray = new VisibilityRay(viewerWorldPos, poiWorldPos);
                    cache.push({ poi, ray, intersection: undefined, invalidRay: false, invalidAngle: false });
                }

                if (!ray.rayValid) {
                    const result = this.map.castRay(ray);
                    if (result) {
                        ray.intersection = result.pos;
                    } else {
                        ray.intersection = undefined;
                    }
                    ray.rayValid = true;
                }

                // TODO: Check if the angle is valid.
            }
        }
    }
}
