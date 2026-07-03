import { describe, expect, it } from "vitest";
import {
    calcPenetrationEnergy,
    calcPixelPenetrationCost,
    calcRicochetProbability,
    calcSurfacePenetrationResistance,
    evaluateSurfacePenetration,
    isGrazingImpact
} from "./Penetration.js";

const NATO_556 = {
    massKg: 0.004,
    velocityMps: 993,
    hardness: 1,
    shape: 1
};

const BUCKSHOT = {
    massKg: 0.0034,
    velocityMps: 488,
    hardness: 0.8,
    shape: 0
};

const THIN_WOOD = {
    hardness: 0.15,
    toughness: 0.25,
    density: 0.08,
    roughness: 0.8,
    elasticity: 0.05
};

const THICK_WOOD = {
    hardness: 0.35,
    toughness: 0.85,
    density: 0.12,
    roughness: 0.6,
    elasticity: 0.1
};

const THIN_METAL = {
    hardness: 0.55,
    toughness: 0.5,
    density: 0.35,
    roughness: 0.15,
    elasticity: 0.5
};

const CONCRETE = {
    hardness: 0.85,
    toughness: 0.65,
    density: 0.75,
    roughness: 0.4,
    elasticity: 0.25
};

describe("calcPenetrationEnergy", () => {
    it("gives 5.56mm NATO substantially more energy than buckshot", () => {
        const nato = calcPenetrationEnergy(NATO_556);
        const buckshot = calcPenetrationEnergy(BUCKSHOT);

        expect(nato).toBeGreaterThan(buckshot * 5);
        expect(nato).toBeCloseTo(99, 0);
        expect(buckshot).toBeCloseTo(9, 0);
    });
});

describe("surface penetration scenarios", () => {
    it("5.56mm penetrates all wood types head-on", () => {
        const energy = calcPenetrationEnergy(NATO_556);

        for (const material of [THIN_WOOD, THICK_WOOD]) {
            const resistance = calcSurfacePenetrationResistance(material, 25, 1);
            expect(evaluateSurfacePenetration(energy, resistance)).toBe("penetrate");
        }
    });

    it("5.56mm penetrates concrete head-on but not at shallow angles", () => {
        const energy = calcPenetrationEnergy(NATO_556);
        const headOn = calcSurfacePenetrationResistance(CONCRETE, 30, 1);
        const shallow = calcSurfacePenetrationResistance(CONCRETE, 30, 0.15);

        expect(evaluateSurfacePenetration(energy, headOn)).toBe("penetrate");
        expect(evaluateSurfacePenetration(energy, shallow)).toBe("no-penetration");
    });

    it("buckshot only penetrates thin wood and thin sheet metal", () => {
        const energy = calcPenetrationEnergy(BUCKSHOT);

        expect(
            evaluateSurfacePenetration(energy, calcSurfacePenetrationResistance(THIN_WOOD, 8, 1))
        ).toBe("penetrate");

        expect(
            evaluateSurfacePenetration(energy, calcSurfacePenetrationResistance(THIN_METAL, 4, 1))
        ).toBe("penetrate");

        expect(
            evaluateSurfacePenetration(energy, calcSurfacePenetrationResistance(THICK_WOOD, 30, 1))
        ).toBe("no-penetration");

        expect(
            evaluateSurfacePenetration(energy, calcSurfacePenetrationResistance(CONCRETE, 20, 1))
        ).toBe("no-penetration");
    });
});

describe("calcPixelPenetrationCost", () => {
    it("concrete drains energy much faster per pixel than thin wood", () => {
        const concreteCost = calcPixelPenetrationCost(CONCRETE);
        const woodCost = calcPixelPenetrationCost(THIN_WOOD);

        expect(concreteCost).toBeGreaterThan(woodCost * 10);
    });
});

describe("isGrazingImpact", () => {
    it("treats shallow angles as grazing", () => {
        expect(isGrazingImpact(0.2)).toBe(true);
        expect(isGrazingImpact(0.8)).toBe(false);
    });
});

describe("calcRicochetProbability", () => {
    it("returns zero when bounce is zero", () => {
        expect(calcRicochetProbability(0.2, 1, CONCRETE, 0)).toBe(0);
    });

    it("returns one when bounce is one", () => {
        expect(calcRicochetProbability(0.9, 1, CONCRETE, 1)).toBe(1);
    });

    it("increases at shallow impact angles", () => {
        const shallow = calcRicochetProbability(0.1, 1, CONCRETE, 0.75);
        const headOn = calcRicochetProbability(0.95, 1, CONCRETE, 0.75);

        expect(shallow).toBeGreaterThan(0.5);
        expect(shallow).toBeGreaterThan(headOn);
    });

    it("grazing 5.56mm against concrete is likely to ricochet", () => {
        const probability = calcRicochetProbability(0.2, 1, CONCRETE, 0.75);

        expect(probability).toBeGreaterThan(0.6);
    });
});
