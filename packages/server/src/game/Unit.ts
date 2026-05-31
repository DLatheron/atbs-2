import z from "zod";

export const UnitRecipe = z.object({});
export type UnitRecipe = z.infer<typeof UnitRecipe>;

export class Unit {}
