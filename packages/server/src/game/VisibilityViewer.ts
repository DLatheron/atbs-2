import type { Orientation, TilePos } from "@atbs/maths";
import type { InterestMask } from "@atbs/shared-data";
import type { VisibilityPoi } from "./VisibilityPoi.js";

export interface VisibilityViewer {
    get interestMasks(): InterestMask[];
    set interestMasks(value: InterestMask[]);

    get location(): TilePos | null;
    set location(value: TilePos | null);

    get orientation(): Orientation;
    set orientation(value: Orientation);

    get pois(): VisibilityPoi[];
}
