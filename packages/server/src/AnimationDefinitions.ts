import { AnimationRecipe } from "@atbs/shared-data";

// TODO: Move this into a VfxDefinitions file...
export const Smoke: AnimationRecipe = {
    id: "smoke.vfx",
    stateDef: {
        scale: [
            0,
            [
                { type: "linear", startOffset: 0, duration: 1000, toValue: 100 },
                { type: "ease-in", powerIn: 4, startOffset: 1000, duration: 10000, toValue: 0 }
            ]
        ],
        rotation: 0,
        opacity: [0, [{ type: "linear", startOffset: 0, duration: 500, toValue: 1 }]],
        renderable: {
            default: [{ imageId: "smoke15" }]
        }
    }
};
