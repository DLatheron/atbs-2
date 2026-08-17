import z from "zod";
import { AnimationId, ImageId, SceneNode, VfxId } from "@atbs/shared-data";

export const VfxRecipe = z.object({
    id: VfxId,
    animationRecipeIds: z.array(AnimationId),
    disappearAnimationId: AnimationId.optional(),
    collisionImageId: ImageId.optional(),
    renderable: SceneNode.optional()
});
export type VfxRecipe = z.infer<typeof VfxRecipe>;
