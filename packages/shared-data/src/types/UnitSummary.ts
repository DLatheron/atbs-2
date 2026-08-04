import { ITilePos, Orientation } from "@atbs/maths";
import z from "zod";

import { UnitActionGrid } from "./ActionTypes.js";
import {
    UnitId,
    Description,
    Attribute,
    RenderList,
    ItemSummary,
    Actions
} from "./PrimitiveTypes.js";

export const UnitSummary = z.object({
    id: UnitId,
    name: z.string().nonempty(),
    description: Description,
    location: ITilePos,
    orientation: z.enum(Orientation),
    disorientation: z.int().nonnegative(),
    viewAngleInDegrees: z.int().positive(),
    collisionRadius: z.number().positive(),
    isDirectional: z.boolean().optional().default(true),
    canSee: z.number().nonnegative(),
    isOvertaking: z.boolean(),
    attributes: z.object({
        actionPoints: Attribute,
        constitution: Attribute,
        fitness: Attribute,
        morale: Attribute,
        stamina: Attribute,
        speed: Attribute,
        strength: Attribute,
        weight: z.number().positive()
    }),
    uiImage: RenderList,
    interactions: z.object({
        canFire: z.boolean(),
        canThrow: z.boolean(),
        canAction: z.boolean(),
        canInventory: z.boolean()
    }),
    itemInUse: ItemSummary.nullable(),
    actions: Actions,
    unitActionGrid: UnitActionGrid
});
export type UnitSummary = z.infer<typeof UnitSummary>;
