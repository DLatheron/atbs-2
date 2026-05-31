import { CanvasLoopComponentProps } from "./components/CanvasLoop";

export class World {
    renderWorld({ canvas, context }: CanvasLoopComponentProps) {
        const { width, height } = canvas;

        context.clearRect(0, 0, width, height);
    }
}
