import { describe, expect, it } from "vitest";
import { Orientation } from "@atbs/maths";
import {
    classifyMeleeFacing,
    MELEE_TUNABLES,
    resolveMeleeCombat,
    type MeleeCombatantInput
} from "./MeleeCombat.js";
import { BARE_HANDS_MELEE, DEFAULT_UNIT_MELEE, type ItemMelee } from "./MeleeTypes.js";

function combatant(
    overrides: Partial<MeleeCombatantInput> & { weapon?: ItemMelee } = {}
): MeleeCombatantInput {
    return {
        melee: { ...DEFAULT_UNIT_MELEE, ...(overrides.melee ?? {}) },
        weapon: overrides.weapon ?? BARE_HANDS_MELEE,
        strength: overrides.strength ?? 50,
        speed: overrides.speed ?? 50,
        staminaRatio: overrides.staminaRatio ?? 1,
        moraleRatio: overrides.moraleRatio ?? 1
    };
}

const noVariance = () => 0.5;

describe("classifyMeleeFacing", () => {
    it("treats approach from the defender's front as front", () => {
        // Defender faces north; attacker moves south into them (approach from north).
        expect(classifyMeleeFacing(Orientation.NORTH, Orientation.SOUTH)).toBe("front");
    });

    it("treats approach from behind as rear", () => {
        // Defender faces north; attacker moves north into them (approach from south).
        expect(classifyMeleeFacing(Orientation.NORTH, Orientation.NORTH)).toBe("rear");
    });

    it("treats side approaches as flank", () => {
        expect(classifyMeleeFacing(Orientation.NORTH, Orientation.WEST)).toBe("flank");
    });
});

describe("resolveMeleeCombat", () => {
    it("deals defender damage when the attacker outclasses the defender", () => {
        const result = resolveMeleeCombat({
            attacker: combatant({
                melee: { ...DEFAULT_UNIT_MELEE, attack: 80 },
                weapon: { class: "knife", attack: 20, defence: 2, usable: true }
            }),
            defender: combatant({
                melee: { ...DEFAULT_UNIT_MELEE, defence: 10 },
                staminaRatio: 0.2,
                moraleRatio: 0.2
            }),
            attackDirection: Orientation.NORTH,
            defenderOrientation: Orientation.NORTH,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        expect(result.wasBackfire).toBe(false);
        expect(result.defenderDamage).toBeGreaterThan(0);
        expect(result.attackerDamage).toBe(0);
    });

    it("backfires at roughly half a normal defender strike when heavily outclassed", () => {
        const result = resolveMeleeCombat({
            attacker: combatant({
                melee: { ...DEFAULT_UNIT_MELEE, attack: 5 },
                staminaRatio: 0.1,
                moraleRatio: 0.1
            }),
            defender: combatant({
                melee: { ...DEFAULT_UNIT_MELEE, attack: 70, defence: 80 },
                weapon: { class: "baton", attack: 15, defence: 10, usable: true }
            }),
            attackDirection: Orientation.NORTH,
            defenderOrientation: Orientation.SOUTH,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        expect(result.wasBackfire).toBe(true);
        expect(result.defenderDamage).toBe(0);
        expect(result.attackerDamage).toBeGreaterThan(0);
        expect(result.offense / result.defence).toBeLessThan(MELEE_TUNABLES.backfireRatio);
    });

    it("applies knife proficiency to offense", () => {
        const without = resolveMeleeCombat({
            attacker: combatant({
                weapon: { class: "knife", attack: 15, defence: 0, usable: true }
            }),
            defender: combatant({ melee: { ...DEFAULT_UNIT_MELEE, defence: 20 } }),
            attackDirection: Orientation.EAST,
            defenderOrientation: Orientation.EAST,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        const withProf = resolveMeleeCombat({
            attacker: combatant({
                melee: {
                    ...DEFAULT_UNIT_MELEE,
                    proficiency: { knife: { attack: 2 } }
                },
                weapon: { class: "knife", attack: 15, defence: 0, usable: true }
            }),
            defender: combatant({ melee: { ...DEFAULT_UNIT_MELEE, defence: 20 } }),
            attackDirection: Orientation.EAST,
            defenderOrientation: Orientation.EAST,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        expect(withProf.offense).toBeGreaterThan(without.offense);
        expect(withProf.defenderDamage).toBeGreaterThanOrEqual(without.defenderDamage);
    });

    it("boosts offense for an unseen rear sneak attack", () => {
        const frontal = resolveMeleeCombat({
            attacker: combatant({ melee: { ...DEFAULT_UNIT_MELEE, attack: 40 } }),
            defender: combatant({ melee: { ...DEFAULT_UNIT_MELEE, defence: 40 } }),
            attackDirection: Orientation.SOUTH,
            defenderOrientation: Orientation.NORTH,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        const sneakRear = resolveMeleeCombat({
            attacker: combatant({ melee: { ...DEFAULT_UNIT_MELEE, attack: 40 } }),
            defender: combatant({ melee: { ...DEFAULT_UNIT_MELEE, defence: 40 } }),
            attackDirection: Orientation.NORTH,
            defenderOrientation: Orientation.NORTH,
            turnsSinceDefenderSawAttacker: null,
            rng: noVariance
        });

        expect(sneakRear.wasSneak).toBe(true);
        expect(sneakRear.facing).toBe("rear");
        expect(sneakRear.offense).toBeGreaterThan(frontal.offense);
        expect(sneakRear.defence).toBeLessThan(frontal.defence);
    });

    it("gives almost no rear benefit when the attacker was seen this turn", () => {
        const seenRear = resolveMeleeCombat({
            attacker: combatant(),
            defender: combatant(),
            attackDirection: Orientation.NORTH,
            defenderOrientation: Orientation.NORTH,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        const front = resolveMeleeCombat({
            attacker: combatant(),
            defender: combatant(),
            attackDirection: Orientation.SOUTH,
            defenderOrientation: Orientation.NORTH,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        expect(seenRear.facing).toBe("rear");
        expect(seenRear.defence / front.defence).toBeCloseTo(
            MELEE_TUNABLES.sneakSameTurnRearDefence / MELEE_TUNABLES.frontDefenceMult,
            5
        );
    });

    it("reduces power when stamina and morale are low", () => {
        const fresh = resolveMeleeCombat({
            attacker: combatant({ staminaRatio: 1, moraleRatio: 1 }),
            defender: combatant(),
            attackDirection: Orientation.NORTH,
            defenderOrientation: Orientation.SOUTH,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        const exhausted = resolveMeleeCombat({
            attacker: combatant({ staminaRatio: 0, moraleRatio: 0 }),
            defender: combatant(),
            attackDirection: Orientation.NORTH,
            defenderOrientation: Orientation.SOUTH,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        expect(exhausted.offense).toBeLessThan(fresh.offense);
    });

    it("uses bare hands when no weapon profile is stronger", () => {
        const fists = resolveMeleeCombat({
            attacker: combatant({ weapon: BARE_HANDS_MELEE }),
            defender: combatant({ melee: { ...DEFAULT_UNIT_MELEE, defence: 5 } }),
            attackDirection: Orientation.NORTH,
            defenderOrientation: Orientation.SOUTH,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        const knife = resolveMeleeCombat({
            attacker: combatant({
                weapon: { class: "knife", attack: 18, defence: 2, usable: true }
            }),
            defender: combatant({ melee: { ...DEFAULT_UNIT_MELEE, defence: 5 } }),
            attackDirection: Orientation.NORTH,
            defenderOrientation: Orientation.SOUTH,
            turnsSinceDefenderSawAttacker: 0,
            rng: noVariance
        });

        expect(knife.offense).toBeGreaterThan(fists.offense);
    });
});
