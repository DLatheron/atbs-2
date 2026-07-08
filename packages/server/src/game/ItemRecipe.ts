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
    FireType,
    VisualRecipe
} from "@atbs/shared-data";
import z from "zod";
import { SceneNode } from "./SceneObject.js";
import { TilePos } from "@atbs/maths";

export const Slot = z.object({
    id: ItemId,
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

export const ProjectileRecipe = z.object({
    numProjectiles: z.number().positive().default(1),
    variability: z
        .object({
            min: z.number().positive().max(2).default(1),
            max: z.number().positive().max(2).default(1)
        })
        .refine((data) => data.min <= data.max, {
            message: "Variability 'max' must be greater than 'min'"
        })
        .describe("Variability applied to each projectile in a multiple projectile spread")
        .optional(),
    maxRange: z.number().positive(),
    perturbation: z.number().min(0).max(100).default(0),
    visual: VisualRecipe,
    damage: DamageMap,

    mass: z.number().positive().describe("Mass in kilograms"),
    velocity: z.number().positive().describe("Velocity in metres per second"),
    diameter: z.number().positive().describe("Diameter in millimeters"),
    hardness: z.number().min(0).max(1).describe("Hardness: 0 - soft, 1 - hard"),
    shape: z.number().min(0).max(1).describe("Shape: 0 - round, 1 - pointed/armour piercing"),
    stability: z.number().min(0).max(1).describe("Resistance to random perturbation"),
    bounce: z
        .number()
        .min(0)
        .max(1)
        .describe("Ricochet tendency: 0 = never, 1 = always (e.g. thrown grenades)"),
    integrity: z.number().nonnegative().describe("How easily the projectile breaks apart"),

    explosion: Explosion.optional()
});
export type ProjectileRecipe = z.infer<typeof ProjectileRecipe>;

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
        slots: z.partialRecord(SlotType, Slot).optional()
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
        fireType: FireType,
        spreadAngle: z.number().nonnegative().default(0)
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
        slots: z.partialRecord(SlotType, Slot).optional()
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
        projectile: ProjectileRecipe,
        slotProps: z.partialRecord(SlotType, SlotProps).optional(),
        slots: z.partialRecord(SlotType, Slot).optional()
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
        explosion: Explosion
    })
]);
export type ItemRecipe = z.infer<typeof ItemRecipe>;

export const ItemOverrides = z
    .object({
        location: TilePos,
        quantity: Quantity
    })
    .partial();
export type ItemOverrides = z.infer<typeof ItemOverrides>;
