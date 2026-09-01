import { useCallback, useEffect } from "react";

export interface KeyboardProps {
    keyMap: Record<string, (event: KeyboardEvent) => void>;
    keyUpMap?: Record<string, (event: KeyboardEvent) => void>;
    disabled: boolean;
}

export function useKeyboard({ keyMap, keyUpMap, disabled = false }: KeyboardProps) {
    const onKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (disabled) {
                return;
            }

            const handler = keyMap[event.code];
            if (handler) {
                event.stopPropagation();
                event.preventDefault();
                handler(event);
            }
        },
        [disabled, keyMap]
    );

    const onKeyUp = useCallback(
        (event: KeyboardEvent) => {
            if (disabled || !keyUpMap) {
                return;
            }

            const handler = keyUpMap[event.code];
            if (handler) {
                event.stopPropagation();
                event.preventDefault();
                handler(event);
            }
        },
        [disabled, keyUpMap]
    );

    useEffect(() => {
        if (disabled) {
            return;
        }

        window.addEventListener("keydown", onKeyDown, false);
        window.addEventListener("keyup", onKeyUp, false);

        return () => {
            window.removeEventListener("keydown", onKeyDown, false);
            window.removeEventListener("keyup", onKeyUp, false);
        };
    }, [disabled, onKeyDown, onKeyUp]);
}
