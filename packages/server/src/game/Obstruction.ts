import { DefaultMap } from "@atbs/maths";
import { z } from "zod";

export const IMPENETRABLE = "impenetrable" as const;

export const MovementObstruction = DefaultMap(
    z.union([
        z.number(),
        z.literal(IMPENETRABLE),
        DefaultMap(z.union([z.number(), z.literal(IMPENETRABLE)]))
    ])
);
export type MovementObstruction = z.infer<typeof MovementObstruction>;

export function calcMovementObstruction(
    movementObstructionMap: MovementObstruction,
    state: string,
    type: string
): number | "impenetrable" {
    if (state in movementObstructionMap) {
        const stateValue = movementObstructionMap[state];
        switch (typeof stateValue) {
            case "number":
            case "string":
                return stateValue;

            default:
                return type in stateValue ? stateValue[type] : stateValue.default;
        }
    }

    const defaultValue = movementObstructionMap.default;
    switch (typeof defaultValue) {
        case "number":
        case "string":
            return defaultValue;

        default:
            return type in defaultValue ? defaultValue[type] : defaultValue.default;
    }
}

export const VisualObstruction = DefaultMap(
    z.union([
        z.number(),
        z.literal(IMPENETRABLE),
        DefaultMap(z.union([z.number(), z.literal(IMPENETRABLE)]))
    ])
);
export type VisualObstruction = z.infer<typeof VisualObstruction>;

export function calcVisualObstruction(
    visualObstructionMap: VisualObstruction,
    state: string,
    type: string
): number | "impenetrable" {
    if (state in visualObstructionMap) {
        const stateValue = visualObstructionMap[state];
        switch (typeof stateValue) {
            case "number":
            case "string":
                return stateValue;

            default:
                return type in stateValue ? stateValue[type] : stateValue.default;
        }
    }

    const defaultValue = visualObstructionMap.default;
    switch (typeof defaultValue) {
        case "number":
        case "string":
            return defaultValue;

        default:
            return type in defaultValue ? defaultValue[type] : defaultValue.default;
    }
}
