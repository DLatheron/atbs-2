import {
    Quantity,
    ItemId,
    Description,
    Weight,
    FireModes,
    Explosion,
    ItemType,
    SightType,
    DamageMap,
    FireSelector,
    Actions
} from "@atbs/shared-data";
import z from "zod";
import { SceneNode } from "./SceneObject.js";
import { TilePosRecipe } from "@atbs/maths";

export const Slot = z.object({
    id: z.string().min(1),
    quantity: Quantity.optional().default(1)
});
export type Slot = z.infer<typeof Slot>;

export const slotType = ["0", "1", "ammo"] as const;
export const SlotType = z.enum(slotType);
export type SlotType = z.infer<typeof SlotType>;

export const SlotProps = z.object({
    compatibleIds: z.array(ItemId).optional().default([]),
    maxQuantity: Quantity.optional().default(1)
});
export type SlotProps = z.infer<typeof SlotProps>;

export const ItemRecipe = z.discriminatedUnion("type", [
    z.object({
        id: ItemId,
        type: z.literal(ItemType.enum.item),
        name: z.string(),
        shortName: z.string().optional(),
        description: Description,
        quantity: Quantity.min(1).max(1).optional().default(1),
        weight: Weight,
        renderable: SceneNode,
        slotProps: z.partialRecord(SlotType, SlotProps).optional(),
        slots: z.partialRecord(SlotType, Slot).optional(),
        actions: Actions
    }),
    z.object({
        id: ItemId,
        type: z.literal(ItemType.enum.gun),
        name: z.string(),
        shortName: z.string().optional(),
        description: Description,
        quantity: Quantity.min(1).max(1).optional().default(1),
        weight: Weight,
        renderable: SceneNode,
        sight: SightType.default(SightType.enum.iron),
        slotProps: z.partialRecord(SlotType, SlotProps).optional(),
        slots: z.partialRecord(SlotType, Slot).optional(),
        fireSelector: FireSelector,
        fireModes: FireModes,
        actions: Actions
    }),
    z.object({
        id: ItemId,
        type: z.literal(ItemType.enum.magazine),
        name: z.string(),
        shortName: z.string().optional(),
        description: Description,
        quantity: Quantity.min(1).max(1).optional().default(1),
        weight: Weight,
        renderable: SceneNode,
        slotProps: z.partialRecord(SlotType, SlotProps).optional(),
        slots: z.partialRecord(SlotType, Slot).optional(),
        explosion: Explosion.optional(),
        actions: Actions
    }),
    z.object({
        id: ItemId,
        type: z.literal(ItemType.enum.round),
        name: z.string(),
        shortName: z.string().optional(),
        description: Description,
        quantity: Quantity.default(1),
        weight: Weight,
        renderable: SceneNode,
        maxRange: z.number().positive(),
        slotProps: z.partialRecord(SlotType, SlotProps).optional(),
        slots: z.partialRecord(SlotType, Slot).optional(),
        explosion: Explosion.optional(),
        damage: DamageMap,
        actions: Actions
    }),
    z.object({
        id: ItemId,
        type: z.literal(ItemType.enum.grenade),
        name: z.string(),
        shortName: z.string().optional(),
        description: Description,
        quantity: Quantity.min(1).max(1).optional().default(1),
        weight: Weight,
        renderable: SceneNode,
        slotProps: z.partialRecord(SlotType, SlotProps).optional(),
        slots: z.partialRecord(SlotType, Slot).optional(),
        explosion: Explosion,
        actions: Actions
    })
]);
export type ItemRecipe = z.infer<typeof ItemRecipe>;

export const ItemOverrides = z
    .object({
        location: TilePosRecipe,
        quantity: Quantity
    })
    .partial();
export type ItemOverrides = z.infer<typeof ItemOverrides>;
