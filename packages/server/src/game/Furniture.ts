import { AttributeDef, Description, FurnitureId, FurnitureStateMap } from "@atbs/shared-data";
import z from "zod";
import { SceneNode } from "./SceneObject.js";

export const FurnitureRecipe = z.object({
    id: FurnitureId,
    name: z.string().nonempty(),
    description: Description,
    renderable: SceneNode,
    hitPoints: AttributeDef.optional(),
    movementObstruction: FurnitureStateMap,
    materials: z.array(z.unknown()),
    action: z.record(z.string().nonempty(), z.unknown()).optional()
});
export type FurnitureRecipe = z.infer<typeof FurnitureRecipe>;

export class Furniture {
    constructor() {}
}
