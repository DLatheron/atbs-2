import { AnimationRecipe } from "@atbs/shared-data";

// TODO: Move this into a VfxDefinitions file...
export const Smoke: AnimationRecipe = {
    id: "smoke.vfx",
    stateDef: {
        scale: [0, [{ type: "linear", startOffset: 0, duration: 1000, toValue: 100 }]],
        opacity: [0, [{ type: "linear", startOffset: 0, duration: 1000, toValue: 1 }]],
        imageId: "smoke15"
    }
};
