import { colourToRGBA, generateRandomBetween, IColour, IVec2, Vec2 } from "@atbs/maths";
import { HitSparkKind } from "@atbs/shared-data";
import { Camera2d } from "./Camera2d";

const LIFETIME_MS = 300;
const SPREAD_MIN_PX = 40;
const SPREAD_MAX_PX = 80;
const GRAVITY_PX_PER_S2 = 200;
const SIZE_MIN_PX = 2;
const SIZE_MAX_PX = 4;
const DISORIENTATION_GLYPH = "💫";
const DISORIENTATION_FONT_PX = 14;

interface SparkParticle {
    worldPos: Vec2;
    velocity: Vec2;
    colour: IColour;
    radius: number;
    ageMs: number;
    kind: HitSparkKind;
}

export class HitSparkParticles {
    private readonly _particles: SparkParticle[] = [];

    spawnBurst(
        worldPos: IVec2,
        colour: IColour,
        direction: IVec2,
        count: number,
        kind: HitSparkKind = "spark"
    ): void {
        const baseAngle = Math.atan2(direction.y, direction.x);
        const origin = new Vec2(worldPos);

        for (let i = 0; i < count; ++i) {
            const angleOffset = generateRandomBetween(-Math.PI / 2, Math.PI / 2);
            const angle = baseAngle + angleOffset;
            const spreadPx = generateRandomBetween(SPREAD_MIN_PX, SPREAD_MAX_PX);
            const speed = (spreadPx / LIFETIME_MS) * 1000;

            this._particles.push({
                worldPos: origin,
                velocity: new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
                colour,
                radius: generateRandomBetween(SIZE_MIN_PX, SIZE_MAX_PX),
                ageMs: 0,
                kind
            });
        }
    }

    update(dtMs: number): void {
        const dtSeconds = dtMs / 1000;

        for (let i = this._particles.length - 1; i >= 0; --i) {
            const particle = this._particles[i];
            particle.ageMs += dtMs;
            particle.velocity = particle.velocity.add(new Vec2(0, GRAVITY_PX_PER_S2 * dtSeconds));
            particle.worldPos = particle.worldPos.add(particle.velocity.scale(dtSeconds));

            if (particle.ageMs >= LIFETIME_MS) {
                this._particles.splice(i, 1);
            }
        }
    }

    render(
        camera: Camera2d,
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
    ): void {
        for (const particle of this._particles) {
            const lifeRatio = particle.ageMs / LIFETIME_MS;
            const alpha = particle.colour.a * (1 - lifeRatio);
            if (alpha <= 0) {
                continue;
            }

            const canvasPos = camera.worldToCanvas(particle.worldPos);

            if (particle.kind === "disorientation") {
                context.save();
                context.globalAlpha = alpha;
                context.font = `${DISORIENTATION_FONT_PX}px sans-serif`;
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(DISORIENTATION_GLYPH, canvasPos.x, canvasPos.y);
                context.restore();
                continue;
            }

            context.fillStyle = colourToRGBA({ ...particle.colour, a: alpha });
            context.beginPath();
            context.arc(canvasPos.x, canvasPos.y, particle.radius, 0, 2 * Math.PI);
            context.fill();
        }
    }

    get isEmpty(): boolean {
        return this._particles.length === 0;
    }
}
