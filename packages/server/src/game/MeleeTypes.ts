import z from "zod";
import { ItemType } from "@atbs/shared-data";

export const MeleeClass = z.enum(["unarmed", "knife", "baton", "club", "stab", "improvised"]);
export type MeleeClass = z.infer<typeof MeleeClass>;

export const MeleeProficiencyEntry = z.object({
    attack: z.number().positive().optional(),
    defence: z.number().positive().optional()
});
export type MeleeProficiencyEntry = z.infer<typeof MeleeProficiencyEntry>;

export const UnitMelee = z.object({
    attack: z.number().nonnegative().default(30),
    defence: z.number().nonnegative().default(30),
    actionPoints: z.number().positive().default(25),
    seenMemoryTurns: z.number().int().nonnegative().default(3),
    proficiency: z.partialRecord(MeleeClass, MeleeProficiencyEntry).optional().default({})
});
export type UnitMelee = z.infer<typeof UnitMelee>;

export const DEFAULT_UNIT_MELEE: UnitMelee = {
    attack: 30,
    defence: 30,
    actionPoints: 20,
    seenMemoryTurns: 3,
    proficiency: {}
};

export const ItemMelee = z.object({
    class: MeleeClass,
    attack: z.number().nonnegative(),
    defence: z.number().nonnegative().optional().default(0),
    usable: z.boolean().optional().default(true)
});
export type ItemMelee = z.infer<typeof ItemMelee>;

export const BARE_HANDS_MELEE: ItemMelee = {
    class: "unarmed",
    attack: 5,
    defence: 2,
    usable: true
};

/** Derive melee stats for recipes that omit an explicit `melee` block. */
export function defaultItemMelee(type: ItemType, weight: number): ItemMelee {
    if (type === ItemType.enum.gun) {
        // Rifles/SMGs as clubs; pistols lighter clubs.
        if (weight >= 3) {
            return { class: "club", attack: 16, defence: 4, usable: true };
        }
        if (weight >= 1.5) {
            return { class: "club", attack: 12, defence: 3, usable: true };
        }
        return { class: "club", attack: 8, defence: 2, usable: true };
    }

    if (type === ItemType.enum.grenade) {
        return { class: "improvised", attack: 3, defence: 0, usable: true };
    }

    if (type === ItemType.enum.magazine || type === ItemType.enum.round) {
        return { class: "improvised", attack: 2, defence: 0, usable: true };
    }

    // Generic items: keys stab; heavier junk is improvised/club; very heavy is unusable.
    if (weight > 40) {
        return { class: "improvised", attack: 1, defence: 0, usable: false };
    }
    if (weight < 0.05) {
        return { class: "stab", attack: 4, defence: 0, usable: true };
    }
    if (weight < 0.5) {
        return { class: "improvised", attack: 5, defence: 1, usable: true };
    }
    if (weight < 2) {
        return { class: "club", attack: 9, defence: 2, usable: true };
    }
    return { class: "club", attack: 14, defence: 3, usable: true };
}

export function resolveItemMelee(
    melee: ItemMelee | undefined,
    type: ItemType,
    weight: number
): ItemMelee {
    if (melee) {
        return {
            class: melee.class,
            attack: melee.attack,
            defence: melee.defence ?? 0,
            usable: melee.usable ?? true
        };
    }
    return defaultItemMelee(type, weight);
}
