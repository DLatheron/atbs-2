import { describe, expect, it, vi } from "vitest";
import { Aabb, Vec2 } from "@atbs/maths";
import { Camera2d } from "./Camera2d";
import { DrawProjectile, orbitalCanvasOffset } from "./RenderHelpers";
import type { Tracer } from "@atbs/shared-data";

function makeTracer(overrides: Partial<Tracer> & { startTimeMs?: number } = {}): Tracer {
    const startTimeMs = overrides.startTimeMs ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function makeCamera(worldBounds?: Aabb): Camera2d {
    const camera = new Camera2d();
    camera.viewportDimensions = new Vec2(800, 600);
    if (worldBounds) {
        camera.worldBounds = worldBounds;
    }
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

    it("is complete once the head and full tail are outside world bounds", () => {
        const { context } = createMockContext();
        const camera = makeCamera(new Aabb(0, 0, 200, 200));
        const tracer = makeTracer({
            segments: [
                { pos: { x: 50, y: 50 }, time: 0 },
                { pos: { x: 5000, y: 50 }, time: 10000 }
            ],
            trailLengthInMs: 40,
            maxRangeInMs: 10000
        });

        // Head at x≈223, tail at x≈203 — both past the right edge, trail does not cut the map.
        expect(DrawProjectile(camera, context, 0, 350, tracer)).toBe(true);
    });

    it("is not complete while the tail still intersects the world", () => {
        const { context } = createMockContext();
        const camera = makeCamera(new Aabb(0, 0, 200, 200));
        const tracer = makeTracer({
            segments: [
                { pos: { x: 50, y: 50 }, time: 0 },
                { pos: { x: 5000, y: 50 }, time: 10000 }
            ],
            trailLengthInMs: 40,
            maxRangeInMs: 10000
        });

        // Head just past the edge, tail still on the map.
        expect(DrawProjectile(camera, context, 0, 320, tracer)).toBe(false);
    });
});

describe("orbitalCanvasOffset", () => {
    it("places 0° at the top and proceeds clockwise", () => {
        expect(orbitalCanvasOffset(0, 10)).toEqual({ x: 0, y: -10 });
        expect(orbitalCanvasOffset(90, 10).x).toBeCloseTo(10);
        expect(orbitalCanvasOffset(90, 10).y).toBeCloseTo(0);
        expect(orbitalCanvasOffset(180, 10).x).toBeCloseTo(0);
        expect(orbitalCanvasOffset(180, 10).y).toBeCloseTo(10);
        expect(orbitalCanvasOffset(270, 10).x).toBeCloseTo(-10);
        expect(orbitalCanvasOffset(270, 10).y).toBeCloseTo(0);
    });
});
