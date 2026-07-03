import {
    buildPenetrationDebugValues,
    calcEntryEnergyCost,
    calcPenetrationEnergy,
    calcRicochetProbability,
    calcVelocityRetention,
    Colour,
    DebugGraphic,
    DebugGraphicType,
    evaluateSurfacePenetration,
    isGrazingImpact,
    rollPenetrationDeflectionDegrees,
    rollRicochetSpreadDegrees,
    Vec2
} from "@atbs/maths";
import type { MaterialPenetrationProps } from "@atbs/maths";
import { Material } from "./Material.js";
import { ImageManager } from "./ImageManager.js";
import { WorldMap } from "./WorldMap.js";

export type MaterialEntryOutcome = "penetrated" | "ricocheted" | "stopped";

export interface PenetrationProjectile {
    mass: number;
    velocity: number;
    hardness: number;
    shape: number;
    stability: number;
    bounce: number;
    life: number;
    directionVector: Vec2;
    changeDirection(direction: Vec2): void;
    nudgeFromSurface(distance: number): void;
}

interface MutablePenetrationProjectile extends PenetrationProjectile {
    velocity: number;
    life: number;
}

function materialPenetrationProps(material: Material): MaterialPenetrationProps {
    return {
        hardness: material.hardness,
        toughness: material.toughness,
        density: material.density,
        roughness: material.roughness,
        elasticity: material.elasticity
    };
}

function pushPenetrationDebugGraphics(
    debugGraphics: DebugGraphic[] | undefined,
    worldPos: Vec2,
    normal: Vec2,
    thicknessPixels: number,
    debugValues: ReturnType<typeof buildPenetrationDebugValues>,
    outcome: MaterialEntryOutcome
): void {
    if (!debugGraphics) {
        return;
    }

    const thicknessEnd = worldPos.add(normal.scale(-thicknessPixels));

    debugGraphics.push(
        {
            type: DebugGraphicType.enum.line,
            srcWorldPos: worldPos,
            dstWorldPos: worldPos.add(normal.scale(12)),
            strokeColour: Colour.Cyan,
            strokeThickness: 1
        },
        {
            type: DebugGraphicType.enum.line,
            srcWorldPos: worldPos,
            dstWorldPos: thicknessEnd,
            strokeColour: Colour.Yellow,
            strokeThickness: 1,
            lineDash: [2, 2]
        },
        {
            type: DebugGraphicType.enum.text,
            worldPos: worldPos.add(new Vec2(4, -8)),
            text: [
                `E:${debugValues.penetrationEnergy.toFixed(1)}`,
                `R:${debugValues.surfaceResistance.toFixed(1)}`,
                `ratio:${debugValues.penetrationRatio.toFixed(2)}`,
                `t:${debugValues.thicknessPixels}px`,
                `∠:${debugValues.impactAngleDot.toFixed(2)}`,
                outcome
            ].join(" "),
            colour: outcome === "penetrated" ? Colour.Green : Colour.Yellow,
            fontSize: 9
        }
    );
}

function resolveRicochet(
    projectile: MutablePenetrationProjectile,
    materialProps: MaterialPenetrationProps,
    normal: Vec2,
    impactAngleDot: number
): boolean {
    const ricochetProbability = calcRicochetProbability(
        impactAngleDot,
        projectile.hardness,
        materialProps,
        projectile.bounce
    );

    if (Math.random() >= ricochetProbability) {
        return false;
    }

    const reflectedDir = projectile.directionVector.reflect(normal);
    const spreadDegrees = rollRicochetSpreadDegrees(
        materialProps,
        projectile.stability,
        impactAngleDot
    );
    projectile.changeDirection(reflectedDir.rotate(spreadDegrees));
    projectile.nudgeFromSurface(2);
    return true;
}

export class PenetrationSystem {
    static calcInitialEnergy(projectile: PenetrationProjectile): number {
        return calcPenetrationEnergy({
            massKg: projectile.mass,
            velocityMps: projectile.velocity,
            hardness: projectile.hardness,
            shape: projectile.shape
        });
    }

    static resolveMaterialEntry(
        map: WorldMap,
        imageManager: ImageManager,
        projectile: MutablePenetrationProjectile,
        material: Material,
        worldPos: Vec2,
        debugGraphics?: DebugGraphic[]
    ): MaterialEntryOutcome {
        let normal = map.calcNormal(imageManager, worldPos);

        // Fallback: treat the incoming direction as head-on when the surface normal
        // cannot be resolved (interior/corner pixels). Previously this skipped all checks.
        if (!normal) {
            normal = projectile.directionVector.scale(-1).normalise();
        }

        const impactAngleDot = projectile.directionVector.calcImpactAngle(normal);
        const thicknessPixels = map.calcMaterialThickness(imageManager, worldPos, normal, material);
        const materialProps = materialPenetrationProps(material);
        const penetrationEnergy = projectile.life;
        const debugValues = buildPenetrationDebugValues(
            penetrationEnergy,
            materialProps,
            thicknessPixels,
            impactAngleDot
        );

        if (projectile.bounce > 0 && isGrazingImpact(impactAngleDot)) {
            if (resolveRicochet(projectile, materialProps, normal, impactAngleDot)) {
                pushPenetrationDebugGraphics(
                    debugGraphics,
                    worldPos,
                    normal,
                    thicknessPixels,
                    debugValues,
                    "ricocheted"
                );
                return "ricocheted";
            }
        }

        const surfaceOutcome = evaluateSurfacePenetration(
            penetrationEnergy,
            debugValues.surfaceResistance
        );

        if (surfaceOutcome === "no-penetration") {
            if (resolveRicochet(projectile, materialProps, normal, impactAngleDot)) {
                pushPenetrationDebugGraphics(
                    debugGraphics,
                    worldPos,
                    normal,
                    thicknessPixels,
                    debugValues,
                    "ricocheted"
                );
                return "ricocheted";
            }

            pushPenetrationDebugGraphics(
                debugGraphics,
                worldPos,
                normal,
                thicknessPixels,
                debugValues,
                "stopped"
            );
            projectile.life = 0;
            return "stopped";
        }

        pushPenetrationDebugGraphics(
            debugGraphics,
            worldPos,
            normal,
            thicknessPixels,
            debugValues,
            "penetrated"
        );

        projectile.life -= calcEntryEnergyCost(debugValues.surfaceResistance);

        const deflectionDegrees = rollPenetrationDeflectionDegrees(
            materialProps,
            projectile.stability
        );
        projectile.changeDirection(projectile.directionVector.rotate(deflectionDegrees));
        projectile.velocity = calcVelocityRetention(
            projectile.velocity,
            material.density,
            thicknessPixels
        );

        return "penetrated";
    }
}
