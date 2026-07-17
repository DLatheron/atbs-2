import z from "zod";
import { SceneNode } from "./SceneObject.js";
import { AnimationId, VfxId } from "@atbs/shared-data";

export const VfxRecipe = z.object({
    id: VfxId,
    animationRecipeId: AnimationId,
    renderable: SceneNode.optional()
});
export type VfxRecipe = z.infer<typeof VfxRecipe>;
