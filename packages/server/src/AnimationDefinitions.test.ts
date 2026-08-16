import { Orientation } from "@atbs/maths";
import { PlayAnimation, SceneObject, interpolateFrame, RenderMode } from "@atbs/shared-data";
import {
    DEATH_DURATION_MS,
    DEATH_HOLD_MS,
    DISORIENTATION_FADE_MS,
    DISORIENTATION_ORBIT_IMAGE_ID,
    DISORIENTATION_ORBIT_MS,
    DISORIENTATION_ORBIT_RADIUS_FACTOR,
    DISORIENTATION_STAR_SIZE,
    UnitDeathRecord,
    buildDisorientationPlayAnimations,
    buildUnitDeathAnimation,
    disorientationStarCount,
    unitDeathAnimId,
    unitDisorientAnimId
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

describe("disorientationStarCount", () => {
    it.each([
        { disorientation: 0, stars: 0 },
        { disorientation: 1, stars: 1 },
        { disorientation: 18, stars: 1 },
        { disorientation: 20, stars: 1 },
        { disorientation: 86, stars: 4 },
        { disorientation: 100, stars: 5 }
    ])("maps $disorientation points to $stars stars", ({ disorientation, stars }) => {
        expect(disorientationStarCount(disorientation)).toBe(stars);
    });
});

describe("buildDisorientationPlayAnimations", () => {
    function rotationSequence(animation: ReturnType<typeof buildDisorientationPlayAnimations>[0]) {
        const rotation = animation.recipe.stateDef.rotation;
        if (!Array.isArray(rotation)) {
            throw new Error("expected a rotation sequence");
        }
        return rotation;
    }

    function opacitySequence(animation: ReturnType<typeof buildDisorientationPlayAnimations>[0]) {
        const opacity = animation.recipe.stateDef.opacity;
        if (!Array.isArray(opacity)) {
            throw new Error("expected an opacity sequence");
        }
        return opacity;
    }

    it("returns no animations when star count is 0", () => {
        expect(
            buildDisorientationPlayAnimations({
                unitId: "unit-1",
                starCount: 0,
                tileSize: 100
            })
        ).toStrictEqual([]);
    });

    it("builds equally spaced looping orbits for 4 stars", () => {
        const animations = buildDisorientationPlayAnimations({
            unitId: "unit-1",
            starCount: 4,
            tileSize: 100
        });

        expect(animations).toHaveLength(4);
        expect(() => PlayAnimation.array().parse(animations)).not.toThrow();
        animations.forEach((animation, index) => {
            const startDeg = 90 * index;
            const [from, steps] = rotationSequence(animation);

            expect(animation.instanceId).toBe(unitDisorientAnimId("unit-1", index));
            expect(animation.worldPos).toBeUndefined();
            expect(animation.recipe.flags?.loop).toBe(true);
            expect(animation.recipe.stateDef.scale).toBe(DISORIENTATION_STAR_SIZE);
            expect(animation.recipe.stateDef.orbitRadius).toBe(
                (100 / 2) * DISORIENTATION_ORBIT_RADIUS_FACTOR
            );
            expect(animation.recipe.stateDef.opacity).toBe(1);
            expect(animation.recipe.stateDef.renderable).toStrictEqual({
                default: [{ imageId: DISORIENTATION_ORBIT_IMAGE_ID }]
            });
            expect(from).toBe(startDeg);
            expect(steps[0]).toMatchObject({
                type: "linear",
                startOffset: 0,
                duration: DISORIENTATION_ORBIT_MS,
                toValue: startDeg + 360
            });
        });
    });

    it("fades opacity out over DISORIENTATION_FADE_MS without looping", () => {
        const [animation] = buildDisorientationPlayAnimations({
            unitId: "unit-1",
            starCount: 1,
            tileSize: 64,
            fade: true
        });

        const [fromOpacity, opacitySteps] = opacitySequence(animation);
        const [fromRotation, rotationSteps] = rotationSequence(animation);

        expect(animation.recipe.flags?.loop).toBeUndefined();
        expect(() => PlayAnimation.parse(animation)).not.toThrow();
        expect(animation.recipe.stateDef.scale).toBe(DISORIENTATION_STAR_SIZE);
        expect(animation.recipe.stateDef.orbitRadius).toBe(
            (64 / 2) * DISORIENTATION_ORBIT_RADIUS_FACTOR
        );
        expect(fromOpacity).toBe(1);
        expect(opacitySteps[0]).toMatchObject({
            type: "linear",
            duration: DISORIENTATION_FADE_MS,
            toValue: 0
        });
        expect(fromRotation).toBe(0);
        expect(rotationSteps[0]).toMatchObject({
            type: "linear",
            duration: DISORIENTATION_FADE_MS,
            toValue: 360 * (DISORIENTATION_FADE_MS / DISORIENTATION_ORBIT_MS)
        });
    });
});
