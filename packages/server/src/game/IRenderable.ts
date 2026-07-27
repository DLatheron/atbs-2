import type { Orientation, TilePos } from "@atbs/maths";
import type { RenderList, SceneContext } from "@atbs/shared-data";

export interface RenderableProps {
    location: TilePos | null;
    isDirectional: boolean;
    orientation: Orientation;
}

export interface IRenderable {
    getRenderList(context: SceneContext): RenderList;
    // getRenderListAllModes(context: SceneContext): Record<RenderMode, RenderList>;
}
