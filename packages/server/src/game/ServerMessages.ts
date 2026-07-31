import type { Unit } from "./Unit.js";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ServerMessages {
    export const DisableUI = {
        type: "server:ui:disabled" as const,
        payload: true
    };

    export const EnableUI = {
        type: "server:ui:disabled" as const,
        payload: false
    };

    export const UnitMovementMode = (unit: Unit | null) => ({
        type: "server:unit:mode:move" as const,
        payload: unit ? unit.toSummary() : null
    });

    export const StartFireMode = (unit: Unit) => ({
        type: "server:unit:mode:fire" as const,
        payload: unit.itemInUse?.getFireModeItemSummary(unit) ?? null
    });

    export const EndFireMode = {
        type: "server:unit:mode:fire:end" as const,
        payload: null
    };

    export const DeselectUnit = {
        type: "server:unit:mode:move" as const,
        payload: null
    };

    export const StartOpportunityFire = (name: string) => ({
        type: "server:opportunity:fire:start" as const,
        payload: { unit: { name } }
    });

    export const EndOpportunityFire = {
        type: "server:opportunity:fire:end" as const,
        payload: null
    };
}
