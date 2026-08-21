import { createContext, useContext } from "react";

export interface TooltipDismissApi {
    subscribe: (listener: () => void) => () => void;
    dismiss: () => void;
}

export const TooltipDismissContext = createContext<TooltipDismissApi | null>(null);

export function useDismissInventoryTooltips(): () => void {
    const api = useContext(TooltipDismissContext);
    return api?.dismiss ?? (() => undefined);
}

export function useInventoryTooltipDismissApi(): TooltipDismissApi | null {
    return useContext(TooltipDismissContext);
}
