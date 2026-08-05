import { Orientation } from "@atbs/maths";
import z from "zod";
import { AttributeTypes, FurnitureState } from "./PrimitiveTypes.js";

export const State = z.string();
export type State = z.infer<typeof State>;

export const UnitActionType = z.string();
export type UnitActionType = z.infer<typeof UnitActionType>;

export const UnitAction = z.object({
    action: UnitActionType,
    disabled: z.boolean().optional()
});
export type UnitAction = z.infer<typeof UnitAction>;

export const UnitActionGrid = z.partialRecord(z.enum(Orientation), z.array(UnitAction));
export type UnitActionGrid = z.infer<typeof UnitActionGrid>;

export const WorldActionDefinition = z.object({
    // State that the action put the entity info.
    state: z.string().or(FurnitureState),

    // Cost to perform the action.
    aptCost: z.number(),

    // Amount that the action scales the unit's speed attribute in opportunity fire calculations.
    speedScaler: z.number().default(1),

    // Items required to perform the action.
    itemsToUse: z.array(z.string()).optional(),

    // Orientation(s) that the action can be performed from.
    orientations: z.array(z.enum(Orientation)).optional(),

    // Whether the item is consumed by the action.
    consumeItem: z.boolean().default(false),

    // Which attributes the action affects on the performing unit and by how much (to the maximum).
    attributes: z.partialRecord(AttributeTypes, z.number()).optional()
});
export type WorldActionDefinition = z.infer<typeof WorldActionDefinition>;

export const ActionDefMap = z.record(UnitActionType, WorldActionDefinition);
export type ActionDefMap = z.infer<typeof ActionDefMap>;

export const FurnitureStateToActionDefMap = z.record(State, ActionDefMap);
export type FurnitureStateToActionDefMap = z.infer<typeof FurnitureStateToActionDefMap>;
