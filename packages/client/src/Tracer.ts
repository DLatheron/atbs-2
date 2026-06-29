import { Tracer } from "@atbs/shared-data";
import { Vec2 } from "../../maths/dist/Vec2";
import { Maths } from "@atbs/maths";

const DEBUG_VELOCITY_SCALER = 1;
// const DEBUG_VELOCITY_SCALER = 0.1;

function pixelLengthToTimeDelta(velocityPerSecond: number, desiredPixelLength: number): number {
    return (1000 / velocityPerSecond) * desiredPixelLength;
}

export interface TracerUpdateProps {
    simulationTime: number;
}

export class VisualTracer {
    private readonly _tracer: Tracer;
    private readonly _startTime: number;
    private readonly _flightTimeInMs: number;

    private _headPos: Vec2;
    private _tailPos: Vec2;
    private _complete: boolean;

    constructor(time: number, tracer: Tracer) {
        this._tracer = tracer;
        this._tracer.visual.velocity *= DEBUG_VELOCITY_SCALER;

        this._startTime = time;
        this._flightTimeInMs = tracer.flightTimeInMs;
        console.info({ flightTimeInMs: this._flightTimeInMs });

        const srcPos = new Vec2(this.srcPos);
        this._headPos = srcPos;
        this._tailPos = srcPos;
        this._complete = false;
    }

    get srcPos() {
        return this._tracer.srcPos;
    }
    get dstPos() {
        return this._tracer.dstPos;
    }
    get velocity() {
        return this._tracer.visual.velocity;
    }
    get maxRange() {
        return this._tracer.maxRange;
    }
    get traceLength() {
        return this._tracer.visual.length;
    }
    get traceIntensity() {
        return this._tracer.visual.intensity;
    }
    get rangeFallOff() {
        return this._tracer.visual.rangeFallOff;
    }
    get isComplete() {
        return this._complete;
    }

    get headPos(): Vec2 {
        return this._headPos;
    }
    get tailPos(): Vec2 {
        return this._tailPos;
    }

    get intensity(): number {
        const rangeTravelled = this._headPos.sub(new Vec2(this._tracer.srcPos)).length;
        const proportionOfMaxRange = Maths.Clamp(rangeTravelled / this.maxRange, 0, 1);
        const intensity = 1.0 - Math.pow(proportionOfMaxRange, this.rangeFallOff);

        return intensity * this.traceIntensity;
    }

    update({ simulationTime }: TracerUpdateProps): boolean {
        const timeDelta = simulationTime - this._startTime;
        const tHead = Maths.Clamp(timeDelta, 0, this._flightTimeInMs) / this._flightTimeInMs;

        const timeDeltaForBackOfRay = pixelLengthToTimeDelta(this.velocity, this.traceLength);

        const tTail =
            Maths.Clamp(timeDelta - timeDeltaForBackOfRay, 0, this._flightTimeInMs) /
            this._flightTimeInMs;

        this._headPos = Vec2.Interpolate(new Vec2(this.srcPos), new Vec2(this.dstPos), tHead);
        this._tailPos = Vec2.Interpolate(new Vec2(this.srcPos), new Vec2(this.dstPos), tTail);

        this._complete = tTail >= 1;

        return !this._complete;
    }
}
