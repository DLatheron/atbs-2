import { Orientation, relativeDirection, rotateOrientation } from "@atbs/maths";
import type { ItemMelee, MeleeClass, MeleeProficiencyEntry, UnitMelee } from "./MeleeTypes.js";

/**
 * All melee balance knobs live here. Callers only consume {@link resolveMeleeCombat} results.
 */
export const MELEE_TUNABLES = {
    strengthWeight: 0.35,
    speedWeight: 0.25,
    /** Attribute reference for neutral strength/speed scaling. */
    attributeReference: 50,
    staminaFloor: 0.45,
    moraleFloor: 0.5,
    frontDefenceMult: 1.0,
    flankDefenceMult: 0.7,
    rearDefenceMult: 0.35,
    /** Offense multiplier when defender has never seen the attacker. */
    sneakNeverSeenOffense: 1.55,
    /** Offense multiplier when last seen on a prior turn (still in memory). */
    sneakStaleOffense: 1.2,
    /** Rear defence when attacker was seen this turn — almost no rear benefit. */
    sneakSameTurnRearDefence: 0.92,
    /** Extra rear defence reduction when never seen. */
    sneakNeverSeenRearExtra: 0.55,
    /** Offense/defence ratio below this triggers a backfire. */
    backfireRatio: 0.4,
    backfireDamageScale: 0.5,
    damageScale: 0.18,
    maxDamage: 40,
    variance: 0.12
} as const;

export type MeleeFacing = "front" | "flank" | "rear";

export interface MeleeCombatantInput {
    melee: UnitMelee;
    weapon: ItemMelee;
    strength: number;
    speed: number;
    /** Current / max, 0–1. */
    staminaRatio: number;
    /** Current / max, 0–1. */
    moraleRatio: number;
}

export interface MeleeResolveInput {
    attacker: MeleeCombatantInput;
    defender: MeleeCombatantInput;
    /** Absolute map direction of the attacker's move into the defender's tile. */
    attackDirection: Orientation;
    defenderOrientation: Orientation;
    /**
     * Turns since the defender last saw the attacker.
     * `null` = never seen (within memory window).
     * `0` = seen this turn.
     */
    turnsSinceDefenderSawAttacker: number | null;
    rng?: () => number;
}

export interface MeleeResolveResult {
    defenderDamage: number;
    attackerDamage: number;
    wasBackfire: boolean;
    wasSneak: boolean;
    facing: MeleeFacing;
    offense: number;
    defence: number;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function proficiencyMultiplier(
    proficiency: Partial<Record<MeleeClass, MeleeProficiencyEntry>> | undefined,
    meleeClass: MeleeClass,
    kind: "attack" | "defence"
): number {
    const entry = proficiency?.[meleeClass];
    const value = entry?.[kind];
    return value !== undefined && value > 0 ? value : 1;
}

function conditionScalar(ratio: number, floor: number): number {
    return floor + (1 - floor) * clamp01(ratio);
}

function buildPower(
    base: number,
    weaponStat: number,
    proficiency: number,
    strength: number,
    speed: number,
    staminaRatio: number,
    moraleRatio: number
): number {
    const { strengthWeight, speedWeight, attributeReference, staminaFloor, moraleFloor } =
        MELEE_TUNABLES;
    const attr =
        1 +
        strengthWeight * (strength / attributeReference - 1) +
        speedWeight * (speed / attributeReference - 1);
    const stamina = conditionScalar(staminaRatio, staminaFloor);
    const morale = conditionScalar(moraleRatio, moraleFloor);
    return Math.max(0, (base + weaponStat * proficiency) * attr * stamina * morale);
}

export function classifyMeleeFacing(
    defenderOrientation: Orientation,
    attackDirection: Orientation
): MeleeFacing {
    // Attacker approaches from the opposite of the move direction.
    const approachFrom = rotateOrientation(attackDirection, 4);
    const relative = Math.abs(relativeDirection(defenderOrientation, approachFrom));
    if (relative >= 3) {
        return "rear";
    }
    if (relative >= 2) {
        return "flank";
    }
    return "front";
}

function facingDefenceMultiplier(facing: MeleeFacing): number {
    switch (facing) {
        case "rear":
            return MELEE_TUNABLES.rearDefenceMult;
        case "flank":
            return MELEE_TUNABLES.flankDefenceMult;
        default:
            return MELEE_TUNABLES.frontDefenceMult;
    }
}

function applyVariance(value: number, rng: () => number): number {
    const { variance } = MELEE_TUNABLES;
    const factor = 1 + (rng() * 2 - 1) * variance;
    return value * factor;
}

/**
 * Resolves a single contested melee exchange. All balance constants are in {@link MELEE_TUNABLES}.
 */
export function resolveMeleeCombat(input: MeleeResolveInput): MeleeResolveResult {
    const rng = input.rng ?? Math.random;
    const { attacker, defender } = input;

    const facing = classifyMeleeFacing(input.defenderOrientation, input.attackDirection);
    const turnsSince = input.turnsSinceDefenderSawAttacker;
    const neverSeen = turnsSince === null;
    const seenThisTurn = turnsSince === 0;
    const wasSneak = neverSeen || (turnsSince !== null && turnsSince > 0);

    let offenseMult = 1;
    if (neverSeen) {
        offenseMult = MELEE_TUNABLES.sneakNeverSeenOffense;
    } else if (!seenThisTurn) {
        offenseMult = MELEE_TUNABLES.sneakStaleOffense;
    }

    let defenceFacing = facingDefenceMultiplier(facing);
    if (facing === "rear") {
        if (seenThisTurn) {
            defenceFacing = MELEE_TUNABLES.sneakSameTurnRearDefence;
        } else if (neverSeen) {
            defenceFacing *= MELEE_TUNABLES.sneakNeverSeenRearExtra;
        }
    }

    const offense =
        buildPower(
            attacker.melee.attack,
            attacker.weapon.attack,
            proficiencyMultiplier(attacker.melee.proficiency, attacker.weapon.class, "attack"),
            attacker.strength,
            attacker.speed,
            attacker.staminaRatio,
            attacker.moraleRatio
        ) * offenseMult;

    const defence =
        buildPower(
            defender.melee.defence,
            defender.weapon.defence,
            proficiencyMultiplier(defender.melee.proficiency, defender.weapon.class, "defence"),
            defender.strength,
            defender.speed,
            defender.staminaRatio,
            defender.moraleRatio
        ) * defenceFacing;

    const ratio = defence > 0 ? offense / defence : Infinity;

    if (ratio < MELEE_TUNABLES.backfireRatio) {
        // Outclassed: backfire at ~50% of a normal defender strike.
        const normalDefenderStrike =
            buildPower(
                defender.melee.attack,
                defender.weapon.attack,
                proficiencyMultiplier(defender.melee.proficiency, defender.weapon.class, "attack"),
                defender.strength,
                defender.speed,
                defender.staminaRatio,
                defender.moraleRatio
            ) * MELEE_TUNABLES.damageScale;

        const backfire = Math.min(
            MELEE_TUNABLES.maxDamage,
            Math.max(
                1,
                Math.round(
                    applyVariance(normalDefenderStrike * MELEE_TUNABLES.backfireDamageScale, rng)
                )
            )
        );

        return {
            defenderDamage: 0,
            attackerDamage: backfire,
            wasBackfire: true,
            wasSneak,
            facing,
            offense,
            defence
        };
    }

    const rawDamage = (offense - defence * 0.5) * MELEE_TUNABLES.damageScale;
    const defenderDamage = Math.min(
        MELEE_TUNABLES.maxDamage,
        Math.max(0, Math.round(applyVariance(Math.max(0, rawDamage), rng)))
    );

    return {
        defenderDamage,
        attackerDamage: 0,
        wasBackfire: false,
        wasSneak,
        facing,
        offense,
        defence
    };
}
