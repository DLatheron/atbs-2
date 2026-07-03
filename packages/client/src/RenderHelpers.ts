import { colourToRGBA, degreesToRadians, IColour, IVec2, PathSegment, Vec2 } from "@atbs/maths";
import { Camera2d } from "./Camera2d";
import { calcFalloff, clamp } from "../../maths/src/Maths";
import { Tracer } from "@atbs/shared-data";

export function DrawProjectile(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseTime: number,
    timeNow: number,
    tracer: Tracer
): boolean {
    const time = Math.max(timeNow - baseTime, 0);
    const strokeThickness = 2;

    const headStartTime = time;
    const tailEndTime = headStartTime - tracer.trailLengthInMs;

    const rangeOpacity = calcFalloff(
        1,
        headStartTime,
        tracer.maxRangeInMs,
        tracer.rangeFalloffPower
    );

    let start = tracer.segments[0];
    let complete = true;

    context.lineWidth = strokeThickness;

    for (let i = 1; i < tracer.segments.length; ++i) {
        const end = tracer.segments[i];

        const overlapsSegment = headStartTime >= start.time && tailEndTime < end.time;
        if (overlapsSegment) {
            const segmentPosDelta = new Vec2(end.pos).sub(start.pos);
            const segmentTimeDelta = end.time - start.time;

            const headStartTimeDelta = headStartTime - start.time;
            const tailEndDelta = tailEndTime - start.time;

            const clampedStartTimeDelta = clamp(headStartTimeDelta, 0, segmentTimeDelta);
            const clampedTailEndDelta = clamp(tailEndDelta, 0, segmentTimeDelta);

            //
            // Head
            //
            if (clampedStartTimeDelta < segmentTimeDelta) {
                const srcCanvasPos = camera.worldToCanvas(
                    new Vec2(start.pos).add(
                        new Vec2(segmentPosDelta.scale(clampedStartTimeDelta / segmentTimeDelta))
                    )
                );

                context.strokeStyle = colourToRGBA({
                    ...tracer.headColour,
                    a: tracer.headColour.a * rangeOpacity
                });
                context.beginPath();
                context.arc(srcCanvasPos.x, srcCanvasPos.y, 2, 0, 2 * Math.PI);
                context.stroke();
            }

            //
            // Tail
            //
            if (clampedStartTimeDelta !== clampedTailEndDelta) {
                const srcCanvasPos = camera.worldToCanvas(
                    new Vec2(start.pos).add(
                        new Vec2(segmentPosDelta.scale(clampedStartTimeDelta / segmentTimeDelta))
                    )
                );
                const dstCanvasPos = camera.worldToCanvas(
                    new Vec2(start.pos).add(
                        new Vec2(segmentPosDelta.scale(clampedTailEndDelta / segmentTimeDelta))
                    )
                );

                const startTailTime = start.time + clampedStartTimeDelta;
                const endTailTime = start.time + clampedTailEndDelta;
                const tailDuration = headStartTime - tailEndTime;
                const startTransparency =
                    (tailDuration > 0
                        ? clamp((startTailTime - tailEndTime) / tailDuration, 0, 1)
                        : 1) * rangeOpacity;
                const endTransparency =
                    (tailDuration > 0
                        ? clamp((endTailTime - tailEndTime) / tailDuration, 0, 1)
                        : 0) * rangeOpacity;

                const gradient = context.createLinearGradient(
                    srcCanvasPos.x,
                    srcCanvasPos.y,
                    dstCanvasPos.x,
                    dstCanvasPos.y
                );
                gradient.addColorStop(
                    0.0,
                    colourToRGBA({
                        ...tracer.trailColour,
                        a: tracer.trailColour.a * startTransparency
                    })
                );
                gradient.addColorStop(
                    1.0,
                    colourToRGBA({
                        ...tracer.trailColour,
                        a: tracer.trailColour.a * endTransparency
                    })
                );
                context.strokeStyle = gradient;
                context.beginPath();
                context.moveTo(srcCanvasPos.x, srcCanvasPos.y);
                context.lineTo(dstCanvasPos.x, dstCanvasPos.y);
                context.stroke();
            }

            complete = false;
        }

        start = end;
    }

    return complete;
}

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

export function DrawRangeSight(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    fromWorldPos: Vec2,
    toWorldPos: Vec2,
    maxRange?: number
): void {
    if (!toWorldPos) {
        return;
    }

    // Limit range...
    const invVector = fromWorldPos.sub(toWorldPos);
    const normal = invVector.normalise();
    let maxDistance = invVector.length;
    if (maxRange && maxDistance > maxRange) {
        toWorldPos = fromWorldPos.sub(normal.scale(maxRange));
        maxDistance = maxRange;
    }

    const sideNormal = normal.rotate(degreesToRadians(90));

    context.fillStyle = "red";
    context.lineWidth = 1;
    context.beginPath();

    let prevPoints = [camera.worldToCanvas(toWorldPos), camera.worldToCanvas(toWorldPos)];

    const from = camera.worldToCanvas(fromWorldPos);
    const to = camera.worldToCanvas(toWorldPos);

    const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y);
    gradient.addColorStop(0, "rgba(0, 255, 0, 0");
    gradient.addColorStop(0.5, "rgba(0, 255, 0, 1");
    gradient.addColorStop(1, "rgba(0, 255, 0, 0");

    const minWidth = 4;
    const maxWidth = 12;

    const points = [
        camera.worldToCanvas(toWorldPos),
        camera.worldToCanvas(toWorldPos.add(sideNormal.scale(20))),
        camera.worldToCanvas(fromWorldPos.add(sideNormal.scale(20))),
        camera.worldToCanvas(fromWorldPos),
        camera.worldToCanvas(toWorldPos.sub(sideNormal.scale(20))),
        camera.worldToCanvas(fromWorldPos.sub(sideNormal.scale(20)))
    ];

    context.beginPath();
    context.strokeStyle = gradient;
    context.moveTo(points[0].x, points[0].y);
    context.bezierCurveTo(
        points[1].x,
        points[1].y,
        points[2].x,
        points[2].y,
        points[3].x,
        points[3].y
    );
    context.moveTo(points[0].x, points[0].y);
    context.bezierCurveTo(
        points[4].x,
        points[4].y,
        points[5].x,
        points[5].y,
        points[3].x,
        points[3].y
    );
    context.stroke();

    for (let distance = 0; distance < maxDistance; distance += 10) {
        const centrePoint = toWorldPos.add(normal.scale(distance));
        const dist = (maxDistance - distance) / maxDistance;
        const power = 2;
        let t;
        if (dist <= 0.5) {
            t = 1.0 - Math.pow(1.0 - dist * 2, power);
        } else {
            t = 1.0 - Math.pow((dist - 0.5) * 2, power);
        }

        const width = t * (maxWidth - minWidth) + minWidth;
        const sidePoints = [
            camera.worldToCanvas(centrePoint.add(sideNormal.scale(width))),
            camera.worldToCanvas(centrePoint.sub(sideNormal.scale(width)))
        ];

        context.beginPath();
        context.fillStyle = gradient;
        context.moveTo(prevPoints[0].x, prevPoints[0].y);
        context.lineTo(prevPoints[1].x, prevPoints[1].y);
        context.lineTo(sidePoints[1].x, sidePoints[1].y);
        context.lineTo(sidePoints[0].x, sidePoints[0].y);
        context.lineTo(prevPoints[0].x, prevPoints[0].y);
        context.fill();

        prevPoints = sidePoints;
    }

    const headSideLength = 35;
    const headAngle = degreesToRadians(60);

    const headPoints = [
        camera.worldToCanvas(toWorldPos.sub(normal.scale(10))),
        camera.worldToCanvas(toWorldPos.add(normal.rotate(headAngle).scale(headSideLength))),
        camera.worldToCanvas(toWorldPos.add(normal.rotate(-headAngle).scale(headSideLength)))
    ];

    context.beginPath();
    context.fillStyle = "limegreen";
    context.moveTo(headPoints[0].x, headPoints[0].y);
    context.lineTo(headPoints[1].x, headPoints[1].y);
    context.lineTo(headPoints[2].x, headPoints[2].y);
    context.lineTo(headPoints[0].x, headPoints[0].y);
    context.fill();
}

export function DrawBulletTrajectory(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    fromWorldPos: Vec2,
    toWorldPos: Vec2
) {
    const fromCanvasPos = camera.worldToCanvas(fromWorldPos);
    const toCanvasPos = camera.worldToCanvas(toWorldPos);

    const gradient0 = context.createLinearGradient(
        fromCanvasPos.x,
        fromCanvasPos.y,
        toCanvasPos.x,
        toCanvasPos.y
    );
    gradient0.addColorStop(0.0, "rgba(0, 0, 0, 0)");
    gradient0.addColorStop(0.9, "rgba(255, 255, 255, 1)");
    gradient0.addColorStop(1.0, "rgba(255, 255, 255, 1)");
    context.strokeStyle = gradient0;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(fromCanvasPos.x, fromCanvasPos.y);
    context.lineTo(toCanvasPos.x, toCanvasPos.y);
    context.stroke();
}

export function DrawBulletTrajectories(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    fromWorldPos: Vec2,
    toWorldPoses: Vec2[]
) {
    const range = toWorldPoses[0].sub(fromWorldPos).length;

    for (const toWorldPos of toWorldPoses) {
        const clippedVector = toWorldPos.sub(fromWorldPos).normalise().scale(range);
        const toWorldPosClipped = fromWorldPos.add(clippedVector);

        DrawBulletTrajectory(camera, context, fromWorldPos, toWorldPosClipped);
    }
}

export function DrawRoundsThatWillBeFired(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    worldPos: Vec2,
    roundsThatWillBeFired: number
) {
    if (roundsThatWillBeFired > 0) {
        const canvasPos = camera.worldToCanvas(worldPos);

        context.fillStyle = "red";
        context.font = "32px sans-serif";
        context.fillText(` x${roundsThatWillBeFired}`, canvasPos.x, canvasPos.y);
        context.stroke();
    }
}

export function DebugDrawBox(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    worldPos: IVec2,
    width: number,
    height: number,
    strokeColour?: IColour,
    strokeThickness?: number,
    fillColour?: IColour
) {
    const canvasPos = camera.worldToCanvas(new Vec2(worldPos));

    context.beginPath();
    context.rect(canvasPos.x, canvasPos.y, width, height);
    if (fillColour) {
        context.fillStyle = colourToRGBA(fillColour);
        context.fill();
    }
    if (strokeColour) {
        context.strokeStyle = colourToRGBA(strokeColour);
        context.lineWidth = strokeThickness ?? 1;
        context.stroke();
    }
}

export function DebugDrawLine(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    srcWorldPos: IVec2,
    dstWorldPos: IVec2,
    strokeColour: IColour,
    strokeThickness?: number,
    lineDash?: number[]
) {
    const srcCanvasPos = camera.worldToCanvas(new Vec2(srcWorldPos));
    const dstCanvasPos = camera.worldToCanvas(new Vec2(dstWorldPos));

    context.beginPath();
    context.moveTo(srcCanvasPos.x, srcCanvasPos.y);
    context.lineTo(dstCanvasPos.x, dstCanvasPos.y);

    context.strokeStyle = colourToRGBA(strokeColour);
    context.setLineDash(lineDash ?? []);
    context.lineWidth = strokeThickness ?? 1;
    context.stroke();
    context.setLineDash([]);
}

export function DebugDrawPath(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
    segments: PathSegment[],
    pathTrail: [number, number, number],
    strokeColour: IColour,
    strokeThickness?: number,
    lineDash?: number[]
) {
    const HEAD_START_INDEX = 0;
    const HEAD_TAIL_INDEX = 1;
    const TAIL_END_INDEX = 2;

    // const segmentsInCanvasSpace = segments.map(({ pos: worldPos, time }) => ({
    //     pos: camera.worldToCanvas(new Vec2(worldPos)),
    //     time
    // }));

    const headStartTime = time + pathTrail[HEAD_START_INDEX];
    const headTailTime = time + pathTrail[HEAD_TAIL_INDEX];
    const tailEndTime = time + pathTrail[TAIL_END_INDEX];

    let start = segments[0];

    context.strokeStyle = colourToRGBA(strokeColour);
    context.setLineDash(lineDash ?? []);
    context.lineWidth = strokeThickness ?? 1;

    for (let i = 1; i < segments.length; ++i) {
        const end = segments[i];

        const overlapsSegment = headStartTime >= start.time && tailEndTime < end.time;
        if (overlapsSegment) {
            const segmentPosDelta = new Vec2(end.pos).sub(start.pos);
            const segmentTimeDelta = end.time - start.time;

            const headStartTimeDelta = headStartTime - start.time;
            const headTailTimeDelta = headTailTime - start.time;
            const tailEndDelta = tailEndTime - start.time;
            // let headTailOpacity = 1;

            const clampedStartTimeDelta = clamp(headStartTimeDelta, 0, segmentTimeDelta);
            const clampedHeadTailTimeDelta = clamp(headTailTimeDelta, 0, segmentTimeDelta);
            const clampedTailEndDelta = clamp(tailEndDelta, 0, segmentTimeDelta);

            if (clampedStartTimeDelta !== clampedHeadTailTimeDelta) {
                const srcCanvasPos = camera.worldToCanvas(
                    new Vec2(start.pos).add(
                        new Vec2(segmentPosDelta.scale(clampedStartTimeDelta / segmentTimeDelta))
                    )
                );
                const dstCanvasPos = camera.worldToCanvas(
                    new Vec2(start.pos).add(
                        new Vec2(segmentPosDelta.scale(clampedHeadTailTimeDelta / segmentTimeDelta))
                    )
                );

                context.strokeStyle = colourToRGBA(strokeColour);
                context.beginPath();
                context.moveTo(srcCanvasPos.x, srcCanvasPos.y);
                context.lineTo(dstCanvasPos.x, dstCanvasPos.y);
                context.stroke();
            }
            if (clampedHeadTailTimeDelta !== clampedTailEndDelta) {
                const srcCanvasPos = camera.worldToCanvas(
                    new Vec2(start.pos).add(
                        new Vec2(segmentPosDelta.scale(clampedHeadTailTimeDelta / segmentTimeDelta))
                    )
                );
                const dstCanvasPos = camera.worldToCanvas(
                    new Vec2(start.pos).add(
                        new Vec2(segmentPosDelta.scale(clampedTailEndDelta / segmentTimeDelta))
                    )
                );

                const startTailTime = start.time + clampedHeadTailTimeDelta;
                const endTailTime = start.time + clampedTailEndDelta;
                const tailDuration = headTailTime - tailEndTime;
                const startTransparency =
                    tailDuration > 0
                        ? clamp((startTailTime - tailEndTime) / tailDuration, 0, 1)
                        : 1;
                const endTransparency =
                    tailDuration > 0 ? clamp((endTailTime - tailEndTime) / tailDuration, 0, 1) : 0;

                const gradient = context.createLinearGradient(
                    srcCanvasPos.x,
                    srcCanvasPos.y,
                    dstCanvasPos.x,
                    dstCanvasPos.y
                );
                gradient.addColorStop(0.0, colourToRGBA({ ...strokeColour, a: startTransparency }));
                gradient.addColorStop(1.0, colourToRGBA({ ...strokeColour, a: endTransparency }));
                context.strokeStyle = gradient;
                context.beginPath();
                context.moveTo(srcCanvasPos.x, srcCanvasPos.y);
                context.lineTo(dstCanvasPos.x, dstCanvasPos.y);
                context.stroke();
            }
        }

        start = end;
    }

    context.setLineDash([]);
}

export function DebugDrawPoint(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    worldPos: IVec2,
    colour: IColour,
    size: number = 1
) {
    const canvasPos = camera.worldToCanvas(
        new Vec2(Math.round(worldPos.x), Math.round(worldPos.y)).sub({
            x: size / 2,
            y: size / 2
        })
    );

    context.fillStyle = colourToRGBA(colour);
    context.fillRect(canvasPos.x, canvasPos.y, size, size);
}

export function DebugDrawArc(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    centerPos: IVec2,
    radius: number,
    startAngleInDegrees: number,
    endAngleInDegrees: number,
    clockwise?: boolean,
    strokeColour?: IColour,
    strokeThickness?: number,
    fillColour?: IColour
) {
    const centerCanvasPos = camera.worldToCanvas(new Vec2(centerPos));
    const angleOffsetInDegreesToRealign = 90;

    context.lineWidth = strokeThickness ?? 1;
    context.beginPath();
    context.moveTo(centerCanvasPos.x, centerCanvasPos.y);
    context.arc(
        centerCanvasPos.x,
        centerCanvasPos.y,
        radius,
        degreesToRadians(startAngleInDegrees - angleOffsetInDegreesToRealign),
        degreesToRadians(endAngleInDegrees - angleOffsetInDegreesToRealign),
        clockwise ?? false
    );
    context.lineTo(centerCanvasPos.x, centerCanvasPos.y);
    if (fillColour) {
        context.fillStyle = colourToRGBA(fillColour);
        context.fill();
    }
    if (strokeColour) {
        context.strokeStyle = colourToRGBA(strokeColour);
        context.stroke();
    }
}

export function DebugDrawText(
    camera: Camera2d,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    worldPos: IVec2,
    text: string,
    colour: IColour,
    fontFamily: string = "sans-serif",
    fontSize: number = 20
) {
    const canvasPos = camera.worldToCanvas(new Vec2(worldPos));

    context.fillStyle = colourToRGBA(colour);
    context.font = `${fontSize}px ${fontFamily}`;
    context.fillText(text, canvasPos.x, canvasPos.y);
    context.stroke();
}
