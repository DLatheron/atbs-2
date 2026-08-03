import { RefObject } from "react";

export interface CanvasLoopProps {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

    offscreenCanvases: OffscreenCanvas[];
    offscreenContexts: OffscreenCanvasRenderingContext2D[];

    frameDelta: number;
    time: number;
}

export function CanvasLoop(
    canvasRef: RefObject<HTMLCanvasElement | null>,
    loopFn?: (props: CanvasLoopProps) => void
) {
    const canvas = canvasRef.current;
    if (!canvas) {
        return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
        return;
    }

    const offscreenCanvases = [
        new OffscreenCanvas(canvas.width, canvas.height),
        new OffscreenCanvas(canvas.width, canvas.height)
    ];

    const offscreenContexts = [
        offscreenCanvases[0].getContext("2d")!,
        offscreenCanvases[1].getContext("2d")!
    ];

    let accumulatedTime = 0;

    // console.warn("Canvas initialised - Should only happen once on map load!!!");

    function loop(time: number): void {
        const frameDelta = time - accumulatedTime;

        loopFn?.({
            canvas: canvas!,
            context: context!,
            offscreenCanvases,
            offscreenContexts,
            frameDelta,
            time
        });

        accumulatedTime = time;
        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}
