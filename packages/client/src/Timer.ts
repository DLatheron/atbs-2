import { clamp, lerp } from "@atbs/maths";
import { TrackingSpeed } from "@atbs/shared-data";

const FREQUENCY_60HZ = 60;

export interface CallbackDetails {
    time: number;
    callbackFn: (time: number) => void;
}

export class Timer {
    private readonly _frequency: number;
    private readonly _timeToCallback: CallbackDetails[] = [];

    private _time: number;
    private _simulationTime: number;
    private _maxSimulationTime: number;

    private _frameNumber: number;
    private _scaler: number;
    private _targetScaler: number;
    private _paused: boolean;

    constructor(frequency = FREQUENCY_60HZ, scaler = 1) {
        this._frequency = frequency;
        this._scaler = scaler;
        this._targetScaler = scaler;

        this._time = this.calcTimeOfFrame(0);
        this._simulationTime = 0;
        this._maxSimulationTime = 0;

        this._frameNumber = 0;

        this._paused = false;
    }

    get targetScaler() {
        return this._scaler;
    }
    set targetScaler(target: number) {
        this._targetScaler = clamp(target, 0, 1);
    }

    get time() {
        return this._time;
    }
    private set time(time: number) {
        this._time = time;
    }

    get simulationTime() {
        return this._simulationTime;
    }
    // set simulationTime(simulationTime: number) { this._simulationTime = simulationTime; }

    get maxSimulationTime() {
        return this._maxSimulationTime;
    }
    set maxSimulationTime(maxSimulationTime: number) {
        this._maxSimulationTime = maxSimulationTime;
    }

    get frameDelta() {
        return 1000 / this._frequency;
    }

    get paused() {
        return this._paused;
    }

    get simulationRunning() {
        return this._simulationTime < this._maxSimulationTime;
    }

    private calcTimeOfFrame(frameNumber: number) {
        return (frameNumber * this._scaler * 1000) / this._frequency;
    }

    registerCallback(time: number, callbackFn: (time: number) => void) {
        if (time < this.time) {
            throw new Error(
                `Attempt made to register a timer callback for ${time}, but the clock is already at ${this.time}`
            );
        }

        this._timeToCallback.push({ time, callbackFn });
        this._timeToCallback.sort((a, b) => a.time - b.time);
    }

    private dispatchCallbacks(untilTime: number) {
        while (this._timeToCallback.length > 0 && this._timeToCallback[0].time <= untilTime) {
            const { time, callbackFn } = this._timeToCallback.shift()!;

            this.time = time;

            callbackFn(time);
        }

        this.time = untilTime;
    }

    pause(): void {
        this._paused = true;
    }

    resume(): void {
        this._paused = false;
    }

    tick(pauseSimulationTime = false): {
        time: number;
        frameDelta: number;
    } {
        if (!this.paused) {
            ++this._frameNumber;

            this._scaler = lerp(this._scaler, this._targetScaler, TrackingSpeed.enum.PRETTY_FAST);

            const newFrameTime = this.calcTimeOfFrame(this._frameNumber);

            this.dispatchCallbacks(newFrameTime);

            if (!pauseSimulationTime && this.simulationRunning) {
                const newSimulationTime =
                    this._simulationTime + this.frameDelta * this.targetScaler;
                this._simulationTime = Math.min(newSimulationTime, this._maxSimulationTime);
            }
        }

        return {
            time: this.time,
            frameDelta: this.frameDelta
        };
    }
}
