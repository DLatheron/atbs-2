import { Aabb, Vec2 } from "@atbs/maths";
import { describe, expect, it } from "vitest";
import { Camera2d } from "./Camera2d";
import { MapCameraConfig } from "./MapCameraConfig";

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
