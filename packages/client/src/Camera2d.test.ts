import { Aabb, Vec2 } from "@atbs/maths";
import { TrackingSpeed } from "@atbs/shared-data";
import { describe, expect, it } from "vitest";
import { Camera2d } from "./Camera2d";
import { MapCameraConfig } from "./MapCameraConfig";

describe("Camera2d constrainToBox", () => {
    it("allows panning when the map is narrower than the viewport", () => {
        const camera = new Camera2d();
        camera.viewportDimensions = new Vec2(2560, 1440);
        camera.worldBounds = new Aabb(0, 0, 1000, 1000);

        const leftAligned = camera["constrainToBox"](new Vec2(0, 500), camera.worldBounds);
        expect(leftAligned.x).toBe(0);

        const rightAligned = camera["constrainToBox"](new Vec2(1000, 500), camera.worldBounds);
        expect(rightAligned.x).toBe(1000);

        const centered = camera["constrainToBox"](new Vec2(500, 500), camera.worldBounds);
        expect(centered.x).toBe(500);
    });

    it("does not snap to the map centre when zoomed out on a small map", () => {
        const camera = new Camera2d();
        camera.viewportDimensions = new Vec2(1920, 1080);
        camera.configureZoom({ maxZoomOutFactor: 4 });
        camera.worldBounds = new Aabb(0, 0, 3200, 3200);
        camera.interpolateToWorldPos(new Vec2(0, 0), TrackingSpeed.enum.IMMEDIATE);
        camera.update({ time: 0, frameDelta: 16 });

        for (let i = 0; i < 80; i++) {
            camera.zoomByWheel(10_000, new Vec2(960, 540));
            camera.update({ time: i, frameDelta: 16 });
        }

        const panned = camera["constrainToBox"](new Vec2(500, 1500), camera.worldBounds);
        expect(panned.x).toBe(500);
        expect(panned.y).toBe(1500);
        expect(panned.x).not.toBe(1600);
    });
    it("keeps the dragged camera under the cursor without snapping to a corner", () => {
        const camera = new Camera2d();
        camera.viewportDimensions = new Vec2(1920, 1080);
        camera.worldBounds = new Aabb(0, 0, 3200, 3200);
        camera.setWorldPosImmediate(new Vec2(1600, 1600));

        // Zoom out until the map is smaller than the viewport on both axes.
        for (let i = 0; i < 80; i++) {
            camera.zoomByWheel(10_000, new Vec2(960, 540));
            camera.update({ time: i, frameDelta: 16 });
        }

        const start = camera.worldPos.clone();
        // Drag 120 canvas pixels right / 80 down → camera should move opposite.
        const dragDelta = new Vec2(120, 80).divide(camera.zoom);
        camera.setWorldPosImmediate(start.sub(dragDelta));

        expect(camera.worldPos.x).toBeCloseTo(start.x - dragDelta.x, 5);
        expect(camera.worldPos.y).toBeCloseTo(start.y - dragDelta.y, 5);
        expect(camera.worldPos.x).not.toBe(0);
        expect(camera.worldPos.y).not.toBe(0);
    });

    it("applies fling inertia and hard-stops at bounds without jumping", () => {
        const camera = new Camera2d();
        camera.viewportDimensions = new Vec2(800, 600);
        camera.worldBounds = new Aabb(0, 0, 4000, 3000);
        camera.setWorldPosImmediate(new Vec2(500, 400));

        // Fling hard toward the top-left bound.
        camera.additionalVelocity = new Vec2(200, 200);

        for (let i = 0; i < 40; i++) {
            camera.update({ time: i, frameDelta: 16 });
        }

        const half = new Vec2(400, 300);
        expect(camera.worldPos.x).toBeCloseTo(half.x, 5);
        expect(camera.worldPos.y).toBeCloseTo(half.y, 5);
        expect(camera.additionalVelocity).toBeNull();
    });
});

describe("Camera2d zoom", () => {
    function createCamera() {
        const camera = new Camera2d();
        camera.viewportDimensions = new Vec2(800, 600);
        camera.worldBounds = new Aabb(0, 0, 4000, 3000);
        camera.interpolateToWorldPos(new Vec2(2000, 1500), 1);
        camera.update({ time: 0, frameDelta: 16 });
        return camera;
    }

    it("defaults to max zoom (fully zoomed in)", () => {
        const camera = createCamera();
        expect(camera.zoom).toBe(MapCameraConfig.maxZoom);
        expect(camera.minZoom).toBe(MapCameraConfig.maxZoom / MapCameraConfig.maxZoomOutFactor);
    });

    it("round-trips canvas and world positions at zoom 1", () => {
        const camera = createCamera();
        const canvasPos = new Vec2(100, 50);
        const worldPos = camera.canvasToWorld(canvasPos);
        expect(camera.worldToCanvas(worldPos).x).toBeCloseTo(canvasPos.x);
        expect(camera.worldToCanvas(worldPos).y).toBeCloseTo(canvasPos.y);
    });

    it("zooms out continuously toward a target and respects the max zoom-out factor", () => {
        const camera = createCamera();
        const focal = new Vec2(400, 300);

        camera.zoomByWheel(800, focal);
        expect(camera.targetZoom).toBeLessThan(camera.zoom);
        expect(camera.targetZoom).toBeGreaterThanOrEqual(camera.minZoom);

        for (let i = 0; i < 60; i++) {
            camera.update({ time: i, frameDelta: 16 });
        }

        expect(camera.zoom).toBeCloseTo(camera.targetZoom, 3);
        expect(camera.zoom).toBeGreaterThanOrEqual(camera.minZoom);
    });

    it("keeps the focal world point under the cursor while zooming", () => {
        const camera = createCamera();
        const focalCanvas = new Vec2(400, 300);
        const focalWorldBefore = camera.canvasToWorld(focalCanvas);

        camera.zoomByWheel(500, focalCanvas);
        for (let i = 0; i < 30; i++) {
            camera.update({ time: i, frameDelta: 16 });
        }

        const focalWorldAfter = camera.canvasToWorld(focalCanvas);
        expect(focalWorldAfter.x).toBeCloseTo(focalWorldBefore.x, 1);
        expect(focalWorldAfter.y).toBeCloseTo(focalWorldBefore.y, 1);
    });

    it("allows configuring the max zoom-out factor", () => {
        const camera = createCamera();
        camera.configureZoom({ maxZoomOutFactor: 8 });
        expect(camera.minZoom).toBeCloseTo(MapCameraConfig.maxZoom / 8);
    });

    it("scales world lengths into canvas pixels", () => {
        const camera = createCamera();
        camera.configureZoom({ maxZoomOutFactor: 4 });
        camera.zoomByWheel(10_000, new Vec2(400, 300));
        for (let i = 0; i < 80; i++) {
            camera.update({ time: i, frameDelta: 16 });
        }

        expect(camera.zoom).toBeCloseTo(camera.minZoom, 3);
        expect(camera.worldLengthToCanvas(100)).toBeCloseTo(100 * camera.minZoom);
    });
});
