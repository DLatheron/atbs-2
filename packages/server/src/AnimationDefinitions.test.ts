import { Orientation } from "@atbs/maths";
import { SceneObject, interpolateFrame, RenderMode } from "@atbs/shared-data";
import {
    DEATH_DURATION_MS,
    DEATH_HOLD_MS,
    UnitDeathRecord,
    buildUnitDeathAnimation,
    unitDeathAnimId
} from "./AnimationDefinitions.js";

describe("buildUnitDeathAnimation", () => {
    const baseRecord: UnitDeathRecord = {
        unitId: "unit-1",
        orientation: Orientation.SOUTH,
        itemInUse: false,
        worldPos: { x: 0, y: 0 },
        timeMs: 1000,
        roundIndex: 2,
        scale: 64
    };

    function frameSequenceToValue(death: ReturnType<typeof buildUnitDeathAnimation>): number {
        const frame = death.playAnimation.recipe.stateDef.frame;
        if (!Array.isArray(frame)) {
            throw new Error("expected a frame sequence");
        }
        return frame[1][0].toValue;
    }

    function framesNode(death: ReturnType<typeof buildUnitDeathAnimation>) {
        const renderable = death.playAnimation.recipe.stateDef.renderable;
        const child = renderable.default;
        if (Array.isArray(child) || !("frames" in child)) {
            throw new Error("expected a frames node under default");
        }
        return child.frames;
    }

    it("uses the shared death anim id for the instance and recipe", () => {
        const death = buildUnitDeathAnimation(baseRecord);
        const expectedId = unitDeathAnimId(baseRecord.unitId, baseRecord.roundIndex);

        expect(death.playAnimation.instanceId).toBe(expectedId);
        expect(death.playAnimation.recipe.id).toBe(expectedId);
    });

    it("omits worldPos and carries the fixed slow duration", () => {
        const death = buildUnitDeathAnimation(baseRecord);

        expect(death.playAnimation.worldPos).toBeUndefined();
        expect(death.durationMs).toBe(DEATH_DURATION_MS);
        expect(DEATH_DURATION_MS).toBe(2500);
    });

    it("carries the configurable post-spin hold duration", () => {
        const death = buildUnitDeathAnimation(baseRecord);

        expect(death.holdMs).toBe(DEATH_HOLD_MS);
        expect(DEATH_HOLD_MS).toBe(500);
    });

    it("steps frames instead of continuously rotating", () => {
        const death = buildUnitDeathAnimation(baseRecord);

        expect(death.playAnimation.recipe.stateDef.rotation).toBe(0);
        expect(Array.isArray(death.playAnimation.recipe.stateDef.frame)).toBe(true);
        expect(death.playAnimation.recipe.stateDef.orientation).toBeUndefined();
    });

    it.each([
        { orientation: Orientation.NORTH, base: "generic-" },
        { orientation: Orientation.EAST, base: "generic-" },
        { orientation: Orientation.SOUTH, base: "generic-" },
        { orientation: Orientation.NORTH_WEST, base: "generic-" },
        { orientation: Orientation.CENTER, base: "generic-" }
    ])(
        "orders 8 frames starting at the (normalised) orientation $orientation",
        ({ orientation, base }) => {
            const death = buildUnitDeathAnimation({ ...baseRecord, orientation });
            const frames = framesNode(death);
            const D =
                orientation >= Orientation.NORTH && orientation <= Orientation.NORTH_WEST
                    ? orientation
                    : Orientation.SOUTH;

            expect(frames).toHaveLength(8);
            frames.forEach((child, i) => {
                expect(child).toStrictEqual([{ imageId: `${base}${(D + i) % 8}` }]);
            });
        }
    );

    it("uses carrying sprites when an item is in use", () => {
        const death = buildUnitDeathAnimation({ ...baseRecord, itemInUse: true });
        const frames = framesNode(death);

        frames.forEach((child, i) => {
            expect(child).toStrictEqual([{ imageId: `generic-carrying-${(4 + i) % 8}` }]);
        });
    });

    it.each([
        Orientation.NORTH,
        Orientation.NORTH_EAST,
        Orientation.EAST,
        Orientation.SOUTH_EAST,
        Orientation.SOUTH,
        Orientation.SOUTH_WEST,
        Orientation.WEST,
        Orientation.NORTH_WEST,
        Orientation.CENTER
    ])("spins >= 2 revolutions and lands on SOUTH from orientation %i", (orientation) => {
        const death = buildUnitDeathAnimation({ ...baseRecord, orientation });
        const D =
            orientation >= Orientation.NORTH && orientation <= Orientation.NORTH_WEST
                ? orientation
                : Orientation.SOUTH;
        const stepCount = frameSequenceToValue(death);

        expect(stepCount).toBeGreaterThanOrEqual(16);
        expect((D + stepCount) % 8).toBe(Orientation.SOUTH);

        // End-to-end: driving the frame channel to t=1 and resolving through the
        // frames node must display the SOUTH-facing sprite.
        const frame = interpolateFrame(0, stepCount, 1);
        const sceneObject = new SceneObject(death.playAnimation.recipe.stateDef.renderable);
        const rendered = sceneObject.getRenderList({
            renderMode: RenderMode.enum.MAP_MODE,
            frame,
            states: ["default"]
        });

        const base = "generic-";
        expect(rendered).toStrictEqual([{ imageId: `${base}${Orientation.SOUTH}` }]);

        // At the start the unit's current orientation is shown.
        const startRendered = sceneObject.getRenderList({
            renderMode: RenderMode.enum.MAP_MODE,
            frame: 0,
            states: ["default"]
        });
        expect(startRendered).toStrictEqual([{ imageId: `${base}${D}` }]);
    });
});
