import type { Orientation, TilePos } from "@atbs/maths";
import type { InterestMask, VisualType } from "@atbs/shared-data";
import type { VisibilityPoi } from "./VisibilityPoi.js";

export interface VisibilityViewer {
    get id(): string;
    get visualType(): VisualType;
    get viewAngleInDegrees(): number;
    get viewRanges(): number[];
    get isDirectional(): boolean;
    get isAlive(): boolean;

    get interestMasks(): InterestMask[];
    set interestMasks(value: InterestMask[]);

    get location(): TilePos | null;
    set location(value: TilePos | null);

    get orientation(): Orientation;
    set orientation(value: Orientation);

    get pois(): VisibilityPoi[];
}
