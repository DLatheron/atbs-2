import { describe, expect, it, vi } from "vitest";
import { Vec2 } from "@atbs/maths";
import { Camera2d } from "./Camera2d";
import { DrawProjectile } from "./RenderHelpers";
import type { Tracer } from "@atbs/shared-data";

function makeTracer(overrides: Partial<Tracer> & { startTimeMs?: number } = {}): Tracer {
    const startTimeMs = overrides.startTimeMs ?? 0;
    const { startTimeMs: _, ...rest } = overrides;
    return {
        segments: [
            { pos: { x: 0, y: 0 }, time: startTimeMs },
            { pos: { x: 100, y: 0 }, time: startTimeMs + 200 }
        ],
        headColour: { r: 255, g: 255, b: 255, a: 1 },
        headRadiusInPixels: 2,
        trailColour: { r: 255, g: 255, b: 255, a: 1 },
        trailLengthInMs: 40,
        maxRangeInMs: 200,
        rangeFalloffPower: 10,
        ...rest
    };
}

function makeCamera(): Camera2d {
    const camera = new Camera2d();
    camera.viewportDimensions = new Vec2(800, 600);
    return camera;
}

function createMockContext() {
    const strokeStyles: unknown[] = [];
    const gradientStops: string[] = [];

    const context = {
        lineWidth: 1,
        strokeStyle: "",
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        createLinearGradient: vi.fn(() => ({
            addColorStop: (_offset: number, colour: string) => {
                gradientStops.push(colour);
            }
        }))
    } as unknown as CanvasRenderingContext2D;

    Object.defineProperty(context, "strokeStyle", {
        get() {
            return strokeStyles.at(-1) ?? "";
        },
        set(value: unknown) {
            strokeStyles.push(value);
        }
    });

    return { context, strokeStyles, gradientStops };
}

describe("DrawProjectile", () => {
    it("is not complete before a delayed tracer's start time", () => {
        const { context } = createMockContext();
        const tracer = makeTracer({ startTimeMs: 250 });

        expect(DrawProjectile(makeCamera(), context, 0, 100, tracer)).toBe(false);
    });

    it("keeps delayed explosion tracers opaque at their start offset", () => {
        const { context, strokeStyles, gradientStops } = createMockContext();
        const tracer = makeTracer({ startTimeMs: 500, maxRangeInMs: 200 });

        // Absolute time 520 is past maxRangeInMs, but only 20ms into this tracer.
        DrawProjectile(makeCamera(), context, 0, 520, tracer);

        const alphas = [...strokeStyles, ...gradientStops]
            .filter((colour): colour is string => typeof colour === "string")
            .map((colour) => {
                const alphaMatch = colour.match(
                    /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/
                );
                expect(alphaMatch).not.toBeNull();
                return Number(alphaMatch![1]);
            });

        expect(alphas.length).toBeGreaterThan(0);
        // Pre-fix, absolute-time falloff made every alpha 0 at this clock time.
        expect(Math.max(...alphas)).toBeGreaterThan(0.9);
    });
});
