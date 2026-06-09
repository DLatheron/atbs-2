import { useCallback, useEffect } from "react";

export interface KeyboardProps {
    keyMap: Record<string, (event: KeyboardEvent) => void>;
    disabled: boolean;
}

export function useKeyboard(
    { keyMap, disabled = false }: KeyboardProps /*, deps: React.DependencyList | undefined = []*/
) {
    const onKeyUp = useCallback(
        (event: KeyboardEvent) => {
            const handler = keyMap[event.code];
            if (handler) {
                event.stopPropagation();
                event.preventDefault();
                handler(event);
            }
        },
        [keyMap]
    );

    useEffect(() => {
        if (disabled) {
            return;
        }

        console.info("Adding useKeyboard handlers...");
        window.addEventListener("keyup", onKeyUp, false);

        return () => {
            console.info("...removing useKeyboard handlers");
            window.removeEventListener("keyup", onKeyUp, false);
        };
    }, [disabled, onKeyUp, keyMap]);
}
