import { RefObject, useCallback, useLayoutEffect, useState } from "react";

export interface TComponentSize {
    width: number;
    height: number;
}

function getSize(element: null | HTMLElement): TComponentSize {
    if (!element) {
        return {
            width: 0,
            height: 0
        };
    }

    return {
        width: element.offsetWidth,
        height: element.offsetHeight
    };
}

export function useComponentSize(ref: RefObject<HTMLElement | null>): TComponentSize {
    const [componentSize, setComponentSize] = useState(getSize(ref.current) ?? {});

    const handleResize = useCallback(
        function handleResize() {
            if (ref.current) {
                setComponentSize(getSize(ref.current));
            }
        },
        [ref]
    );

    useLayoutEffect(
        function onLayoutEffect() {
            const current = ref.current;
            if (!current) {
                return;
            }

            handleResize();

            if (typeof ResizeObserver === "function") {
                const resizeObserver = new ResizeObserver(function () {
                    handleResize();
                });
                resizeObserver.observe(current);

                return function () {
                    resizeObserver.disconnect();
                };
            } else {
                window.addEventListener("resize", handleResize);

                return function () {
                    window.removeEventListener("resize", handleResize);
                };
            }
        },
        [ref, handleResize]
    );

    return componentSize;
}
