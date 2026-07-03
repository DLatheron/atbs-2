import { clamp, generateRandomBetween } from "./Maths.js";

/** Reference momentum (kg·m/s). A 5.56mm NATO round normalises to ~1.0. */
export const REF_MOMENTUM_KGM_S = 4;

/** Scales normalised momentum into a penetration energy budget. */
export const PENETRATION_ENERGY_SCALE = 100;

/** Per-pixel resistance while travelling inside a material. */
export const PIXEL_PENETRATION_COST_SCALE = 3.5;

/** Surface entry resistance multiplier (thickness × obliquity). */
export const SURFACE_PENETRATION_SCALE = 5;

/** Minimum impact-angle dot product when computing oblique thickness. */
export const MIN_IMPACT_ANGLE_DOT = 0.05;

/** Impact angles below this dot product prefer ricochet over penetration (when bounce > 0). */
export const GRAZE_RICOCHET_DOT = 0.45;

/** Fraction of surface resistance paid as energy when entering a material. */
export const ENTRY_ENERGY_FRACTION = 0.5;

export interface ProjectilePenetrationProps {
    massKg: number;
    velocityMps: number;
    hardness: number;
    shape: number;
}

export interface MaterialResistanceProps {
    hardness: number;
    toughness: number;
    density: number;
}

export interface MaterialPenetrationProps extends MaterialResistanceProps {
    roughness: number;
    elasticity: number;
}

export interface PenetrationDebugValues {
    penetrationEnergy: number;
    surfaceResistance: number;
    penetrationRatio: number;
    thicknessPixels: number;
    impactAngleDot: number;
}

export type SurfacePenetrationOutcome = "penetrate" | "no-penetration";

/** Absolute incidence angle dot product (0 = grazing, 1 = head-on). */
export function calcImpactIncidenceDot(directionDotNormal: number): number {
    return Math.abs(directionDotNormal);
}

export function calcEntryEnergyCost(surfaceResistance: number): number {
    return surfaceResistance * ENTRY_ENERGY_FRACTION;
}

export function isGrazingImpact(impactAngleDot: number): boolean {
    return calcImpactIncidenceDot(impactAngleDot) < GRAZE_RICOCHET_DOT;
}

/**
 * Derives a projectile's starting penetration energy from normalised momentum and
 * projectile form (hardness/shape). Replaces hand-authored penetration budgets.
 */
export function calcPenetrationEnergy(props: ProjectilePenetrationProps): number {
    const momentum = props.massKg * props.velocityMps;
    const normalizedMomentum = momentum / REF_MOMENTUM_KGM_S;
    const hardnessFactor = 0.4 + 0.6 * props.hardness;
    const shapeFactor = 0.25 + 0.75 * props.shape;

    return normalizedMomentum * hardnessFactor * shapeFactor * PENETRATION_ENERGY_SCALE;
}

/** Energy consumed for each pixel the projectile travels inside a material. */
export function calcPixelPenetrationCost(material: MaterialResistanceProps): number {
    return (
        material.hardness *
        material.toughness *
        (0.15 + material.density) *
        PIXEL_PENETRATION_COST_SCALE
    );
}

function calcMaterialResistanceFactor(material: MaterialResistanceProps): number {
    return material.hardness * material.toughness * (0.15 + material.density);
}

/**
 * Resistance to entering a material surface. Increases with thickness and obliquity
 * (effective thickness = thickness / impactAngleDot).
 */
export function calcSurfacePenetrationResistance(
    material: MaterialResistanceProps,
    thicknessPixels: number,
    impactAngleDot: number
): number {
    const incidence = Math.max(calcImpactIncidenceDot(impactAngleDot), MIN_IMPACT_ANGLE_DOT);
    const effectiveThickness = thicknessPixels / incidence;

    return calcMaterialResistanceFactor(material) * effectiveThickness * SURFACE_PENETRATION_SCALE;
}

/**
 * Marginal band around ratio 1.0 where penetration is probabilistic.
 */
export function evaluateSurfacePenetration(
    penetrationEnergy: number,
    surfaceResistance: number
): SurfacePenetrationOutcome {
    if (surfaceResistance <= 0) {
        return "penetrate";
    }

    const ratio = penetrationEnergy / surfaceResistance;
    const lowerBound = 0.85;
    const upperBound = 1.15;

    if (ratio < lowerBound) {
        return "no-penetration";
    }

    if (ratio > upperBound) {
        return "penetrate";
    }

    const t = (ratio - lowerBound) / (upperBound - lowerBound);
    return Math.random() < t ? "penetrate" : "no-penetration";
}

/**
 * Ricochet probability when surface penetration fails.
 * `bounce`: 0 = never ricochet, 1 = always ricochet (e.g. grenades), between = scaled chance.
 */
export function calcRicochetProbability(
    impactAngleDot: number,
    projectileHardness: number,
    material: MaterialPenetrationProps,
    bounce: number
): number {
    if (bounce <= 0) {
        return 0;
    }

    if (bounce >= 1) {
        return 1;
    }

    const incidence = calcImpactIncidenceDot(impactAngleDot);
    const angleFactor = Math.pow(1 - clamp(incidence, 0, 1), 1.5);
    const materialFactor = 0.35 + material.hardness * material.elasticity;
    const projectileFactor = 0.3 + 0.7 * projectileHardness;

    return clamp(angleFactor * materialFactor * projectileFactor * bounce * 4, 0, 1);
}

/** Random spread applied to a ricochet reflection, in degrees. */
export function calcRicochetSpreadDegrees(
    material: MaterialPenetrationProps,
    stability: number,
    impactAngleDot: number
): number {
    return material.roughness * (1 - stability) * (1 - clamp(Math.abs(impactAngleDot), 0, 1)) * 45;
}

/** Random spread applied when entering a material, in degrees. */
export function calcPenetrationDeflectionDegrees(
    material: MaterialPenetrationProps,
    stability: number
): number {
    return ((material.roughness * (1 - stability)) / Math.max(stability, 0.1)) * 5;
}

/** Velocity retained after passing through a material slab. */
export function calcVelocityRetention(
    velocity: number,
    materialDensity: number,
    thicknessPixels: number
): number {
    return velocity * Math.exp(-materialDensity * thicknessPixels * 0.02);
}

export function buildPenetrationDebugValues(
    penetrationEnergy: number,
    material: MaterialPenetrationProps,
    thicknessPixels: number,
    impactAngleDot: number
): PenetrationDebugValues {
    const surfaceResistance = calcSurfacePenetrationResistance(
        material,
        thicknessPixels,
        impactAngleDot
    );

    return {
        penetrationEnergy,
        surfaceResistance,
        penetrationRatio: surfaceResistance > 0 ? penetrationEnergy / surfaceResistance : Infinity,
        thicknessPixels,
        impactAngleDot
    };
}

export function rollRicochetSpreadDegrees(
    material: MaterialPenetrationProps,
    stability: number,
    impactAngleDot: number
): number {
    const spread = calcRicochetSpreadDegrees(material, stability, impactAngleDot);
    return generateRandomBetween(-spread, spread);
}

export function rollPenetrationDeflectionDegrees(
    material: MaterialPenetrationProps,
    stability: number
): number {
    const spread = calcPenetrationDeflectionDegrees(material, stability);
    return generateRandomBetween(-spread, spread);
}
