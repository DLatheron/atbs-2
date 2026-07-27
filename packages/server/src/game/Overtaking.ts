import { Unit } from "./Unit.js";
import cloneDeep from "lodash/cloneDeep.js";

export class Overtaking {
    private readonly _unit: Unit;
    private readonly _capturedUnit: Unit;

    constructor(unit: Unit) {
        this._unit = unit;
        this._capturedUnit = cloneDeep(unit);
    }

    get unit(): Unit {
        return this._unit;
    }

    commit() {
        // Unit has already been updated.
    }

    rollback() {
        this._unit.location = this._capturedUnit.location;
        this._unit.orientation = this._capturedUnit.orientation;
        this._unit.actionPoints = this._capturedUnit.actionPoints;
    }
}
