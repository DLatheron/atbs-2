import type { TilePos, Vec2 } from "@atbs/maths";
import { InterestMask } from "@atbs/shared-data";
import { VisibilityRay } from "./VisibilityRay.js";

export interface VisibilityPoi {
    /**
     * The items of interest that this POI contains, e.g. ["items", "side-id-1", "side-id-2", "vfx"].
     */
    get interestMasks(): InterestMask[];

    /**
     * The location of this POI.
     */
    get location(): TilePos;

    /**
     * Whether the given ray intersects this POI, and if it does, exactly where.
     */
    intersectsRay(ray: VisibilityRay): Vec2 | undefined;
}
