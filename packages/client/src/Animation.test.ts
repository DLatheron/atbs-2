import { describe, expect, it } from "vitest";
import { AnimationRecipe } from "@atbs/shared-data";
import { Animation } from "./Animation.js";

const Smoke: AnimationRecipe = {
    id: "smoke.vfx",
    stateDef: {
        scale: [0, [{ type: "linear", startOffset: 0, duration: 1000, toValue: 100 }]],
        opacity: [0, [{ type: "linear", startOffset: 0, duration: 1000, toValue: 1 }]],
        rotation: 0,
        renderable: {
            default: [{ imageId: "smoke15" }]
        }
    }
};

describe("Animation", () => {
    it("should evaluate the state of the animation", () => {
        const animation = new Animation({ instanceId: "smoke.vfx", offset: 0, recipe: Smoke });
        expect(animation.state).toStrictEqual({
            scale: 0,
            opacity: 0,
            rotation: 0,
            orbitRadius: 0,
            orientation: 0,
            frame: 0,
            translation: { x: 50, y: 50 }
        });
    });

    it("should evaluate the state of the animation over time", () => {
        const animation = new Animation({ instanceId: "smoke.vfx", offset: 0, recipe: Smoke });
        animation.startTime = 0;
        animation.update(1000);
        expect(animation.state).toStrictEqual({
            scale: 100,
            opacity: 1,
            rotation: 0,
            orbitRadius: 0,
            orientation: 0,
            frame: 0,
            translation: { x: 50, y: 50 }
        });
    });

    it("should stick to the first state values after the animation has started", () => {
        const animation = new Animation({ instanceId: "smoke.vfx", offset: 0, recipe: Smoke });
        animation.startTime = 0;
        animation.update(0);
        expect(animation.state).toStrictEqual({
            scale: 0,
            opacity: 0,
            rotation: 0,
            orbitRadius: 0,
            orientation: 0,
            frame: 0,
            translation: { x: 50, y: 50 }
        });
    });

    it("should stick to the last state values after the animation has finished", () => {
        const animation = new Animation({ instanceId: "smoke.vfx", offset: 0, recipe: Smoke });
        animation.startTime = 0;
        animation.update(1001);
        expect(animation.state).toStrictEqual({
            scale: 100,
            opacity: 1,
            rotation: 0,
            orbitRadius: 0,
            orientation: 0,
            frame: 0,
            translation: { x: 50, y: 50 }
        });
    });

    it("should interpolate values between the first and last state values", () => {
        const animation = new Animation({ instanceId: "smoke.vfx", offset: 0, recipe: Smoke });
        animation.startTime = 0;
        animation.update(500);
        expect(animation.state).toStrictEqual({
            scale: 50,
            opacity: 0.5,
            rotation: 0,
            orbitRadius: 0,
            orientation: 0,
            frame: 0,
            translation: { x: 50, y: 50 }
        });
    });

    it("should interpolate sub-tile translation from the left edge to the centre", () => {
        const recipe: AnimationRecipe = {
            ...Smoke,
            stateDef: {
                ...Smoke.stateDef,
                translation: [
                    { x: 0, y: 50 },
                    [{ type: "linear", startOffset: 0, duration: 1000, toValue: { x: 50, y: 50 } }]
                ]
            }
        };
        const animation = new Animation({ instanceId: "smoke.vfx", offset: 0, recipe });
        animation.startTime = 0;
        animation.update(0);
        expect(animation.state.translation).toEqual({ x: 0, y: 50 });
        animation.update(500);
        expect(animation.state.translation).toEqual({ x: 25, y: 50 });
        animation.update(1000);
        expect(animation.state.translation).toEqual({ x: 50, y: 50 });
    });
});
