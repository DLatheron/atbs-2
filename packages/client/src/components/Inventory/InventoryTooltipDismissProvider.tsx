import { useMemo, useRef, type ReactNode } from "react";
import { TooltipDismissContext, type TooltipDismissApi } from "./inventoryTooltipDismissContext";

export function InventoryTooltipDismissProvider({ children }: { children: ReactNode }) {
    const listenersRef = useRef(new Set<() => void>());
    const api = useMemo<TooltipDismissApi>(
        () => ({
            subscribe: (listener) => {
                listenersRef.current.add(listener);
                return () => {
                    listenersRef.current.delete(listener);
                };
            },
            dismiss: () => {
                listenersRef.current.forEach((listener) => listener());
            }
        }),
        []
    );

    return <TooltipDismissContext.Provider value={api}>{children}</TooltipDismissContext.Provider>;
}
