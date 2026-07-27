import z from "zod";
import { AnimationId, SceneNode, VfxId } from "@atbs/shared-data";

export const VfxRecipe = z.object({
    id: VfxId,
    animationRecipeIds: z.array(AnimationId),
    renderable: SceneNode.optional()
});
export type VfxRecipe = z.infer<typeof VfxRecipe>;
