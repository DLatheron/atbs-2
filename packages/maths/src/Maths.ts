export function clamp(value: number, inclusiveMin: number = 0, inclusiveMax: number = 1) {
    return Math.max(Math.min(value, inclusiveMax), inclusiveMin);
}

export function wrap(value: number, inclusiveMin: number = 0, exclusiveMax: number = 1) {
    const range = exclusiveMax - inclusiveMin;
    return ((((value - inclusiveMin) % range) + range) % range) + inclusiveMin;
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function generateRandomBetween(min: number, max: number): number {
    const range = max - min;
    return min + Math.random() * range;
}

export function calcFalloff(
    amount: number,
    range: number,
    maxRange: number,
    dropOffPower = 9
): number {
    if (maxRange === 0) {
        return amount;
    } else {
        const clampedRange = Math.min(Math.max(range, 0), maxRange);
        const rangeFalloff = 1 - Math.pow(clampedRange / maxRange, dropOffPower);

        return amount * rangeFalloff;
    }
}

export function roundToScaleMidpoint(value: number, scale: number): number {
    return (Math.floor(value / scale) + 0.5) * scale;
}

export function roundToScale(value: number, scale: number): number {
    return Math.floor(value / scale) * scale;
}

export function calcKineticEnergy(mass: number, velocity: number): number {
    return 0.5 * mass * velocity * velocity;
}

export function calcMomentum(mass: number, velocity: number): number {
    return mass * velocity;
}

export function calcProjectilePower(
    kineticEnergy: number,
    hardness: number,
    shape: number
): number {
    return kineticEnergy * hardness * shape;
}

export function calcMaterialResistance(
    hardness: number,
    toughness: number,
    thickness: number
): number {
    return hardness * toughness * thickness;
}

export function calcPenetrationRatio(projectilePower: number, materialResistence: number): number {
    return projectilePower / materialResistence;
}

export function calcEffectiveThickness(thickness: number, dotOfImpactAngle: number): number {
    return thickness / dotOfImpactAngle;
}

export function calcBaseRicochet(dotOfImpactAngle: number): number {
    return Math.pow(1 - dotOfImpactAngle, 2);
}

export function calcRicochetProbability(
    dotOfImpactAngle: number,
    projectileHardness: number,
    materialHardness: number,
    materialElasticity: number
): number {
    return clamp(
        calcBaseRicochet(dotOfImpactAngle) *
            projectileHardness *
            materialHardness *
            materialElasticity,
        0,
        1
    );
}

export function calcRicochetSpread(
    roughness: number,
    stability: number,
    dotOfImpactAngle: number
): number {
    return roughness * (1 - stability) * (1 - dotOfImpactAngle);
}

export function calcNewVelocity(
    velocity: number,
    materialDensity: number,
    thickness: number,
    constant: number = 0.9
): number {
    return velocity * Math.exp(-materialDensity * thickness * constant);
}

export function calcPenetrationSpread(
    materialRoughness: number,
    materialThickness: number,
    projectileStability: number
): number {
    return (materialRoughness * materialThickness) / projectileStability;
}

export function calcProjectileIntegrity(
    integrity: number,
    velocity: number,
    materialHardness: number
): number {
    return Math.max(integrity - materialHardness * velocity, 0);
}

/**
 * <0.5 No penetration
 * 0.5-1.2 Maybe penetrate (randomly with increasing probability)
 * >1.2 Almost certain penetration
 */
export function evaluatePenetrationRatio(
    penetrationRatio: number
): "penetration" | "no-penetration" {
    const lowerBound = 0.5;
    const upperBound = 1.2;
    const range = upperBound - lowerBound;
    const penetrationCurvePower = 2;

    if (penetrationRatio < lowerBound) {
        return "no-penetration";
    } else if (penetrationRatio > upperBound) {
        return "penetration";
    } else {
        const t = (penetrationRatio - lowerBound) / range;
        const penetrationProbability = Math.pow(t, penetrationCurvePower);
        return Math.random() < penetrationProbability ? "penetration" : "no-penetration";
    }
}
