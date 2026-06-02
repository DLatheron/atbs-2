import type { Orientation, TilePos } from "@atbs/maths";
import type { IRenderable } from "./IRenderable.js";

export interface IRenderableEntity extends IRenderable {
    get location(): TilePos | null;
    get isDirectional(): boolean;
    get orientation(): Orientation;
}
