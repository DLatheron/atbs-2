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
    private _pois: VisibilityPoi[];
    private _viewers: VisibilityViewer[];
    private _cache: Map<VisibilityViewer, VisibilityCacheEntry[]>;

    constructor(game: Game) {
        this._game = game;

        this._pois = [];
        this._viewers = [];
        this._cache = new Map<VisibilityViewer, VisibilityCacheEntry[]>();
    }

    get game(): Game {
        return this._game;
    }

    get map(): WorldMap {
        return this._game.map;
    }

    addPoi(poi: VisibilityPoi): void {
        this._pois.push(poi);
    }

    removePoi(poi: VisibilityPoi): void {
        this._pois = this._pois.filter((p) => p !== poi);
    }

    addViewer(viewer: VisibilityViewer): void {
        this._viewers.push(viewer);
    }

    removeViewer(viewer: VisibilityViewer): void {
        this._viewers = this._viewers.filter((v) => v !== viewer);
    }

    getPois(interestMasks: InterestMask[]): VisibilityPoi[] {
        return this._pois.filter((poi) =>
            poi.interestMasks.some((mask) => interestMasks.includes(mask))
        );
    }

    getViewers(interestMasks: InterestMask[]): VisibilityViewer[] {
        return this._viewers.filter((viewer) =>
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
        for (const viewer of this._viewers) {
            const cache = this.getViewerCache(viewer);

            for (const poi of viewer.pois) {
                if (viewer.location === null || poi.location === null) {
                    continue;
                }

                const viewerWorldPos = this.map.tileCenterToWorld(viewer.location);
                const poiWorldPos = this.map.tileCenterToWorld(poi.location);

                const ray = new VisibilityRay(viewerWorldPos, poiWorldPos);
                const intersection = poi.intersectsRay(ray);
                cache.push({ poi, ray, intersection, invalidRay: false, invalidAngle: false });
            }
        }
    }
}
