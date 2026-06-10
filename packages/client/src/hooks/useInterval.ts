import { useRef, useEffect } from "react";

export function useInterval(
    callback: () => void,
    delay?: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    otherProps: any[] = []
): void {
    const savedCallback = useRef<() => void>(null);

    // Remember the latest callback.
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
        function tick(): void {
            savedCallback.current?.();
        }
        if (delay) {
            const id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [delay, ...otherProps]);
}
