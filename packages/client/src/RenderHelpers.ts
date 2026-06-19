import { Vec2 } from "@atbs/maths";
import { Camera2d } from "./Camera2d";

export function DrawLaserSight(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    fromWorldPos: Vec2,
    toWorldPos: Vec2,
    time = 0
) {
    if (!toWorldPos) {
        return;
    }

    const sequence = [8, 12, 16, 10, 14, 4, 24, 12, 8, 16, 20, 2, 30];
    const sampleCircularly = (index: number): number => {
        const { length } = sequence;
        return sequence[((index % length) + length) % length];
    };
    const sample = (offset: number, number: number): number[] => {
        const samples = [];

        while (--number > 0) {
            samples.push(sampleCircularly(offset + number));
        }

        return samples;
    };

    const fromCanvasPos = camera.worldToCanvas(fromWorldPos);
    const toCanvasPos = camera.worldToCanvas(toWorldPos);

    [
        { timeModulus: 1, divisor: 1, length: 0 },
        { timeModulus: 10000, divisor: 100, length: 8 },
        { timeModulus: 20000, divisor: 200, length: 5 },
        { timeModulus: 5000, divisor: 50, length: 12 }
    ].forEach(({ timeModulus, divisor, length }) => {
        const offset = Math.floor((time % timeModulus) / divisor);
        context.setLineDash(sample(offset, length));
        context.strokeStyle = "rgba(255, 0, 0, 0.25)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(fromCanvasPos.x, fromCanvasPos.y);
        context.lineTo(toCanvasPos.x, toCanvasPos.y);
        context.stroke();
    });

    context.setLineDash([]);
}
