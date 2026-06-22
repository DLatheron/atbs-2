import { ITilePos, TilePos, Vec2 } from "@atbs/maths";
import { WorldMap } from "./WorldMap.js";
import { Unit } from "./Unit.js";

// type HandleMaterialPenetration = (worldPos: Vec2, owner?: Furniture | Unit, material?: Material) => boolean;
export type HandleMaterialPenetration = (
    worldPos: Vec2,
    owner?: Unit,
    material?: unknown
) => boolean;

export type XYAxis =
    | {
          major: "x";
          minor: "y";
      }
    | {
          major: "y";
          minor: "x";
      };

export type RCAxis =
    | {
          major: "col";
          minor: "row";
      }
    | {
          major: "row";
          minor: "col";
      };

interface SignAxis {
    major: number;
    minor: number;
}

export class Ray {
    private readonly _srcPos: Vec2;
    private readonly _dstPos: Vec2;
    private readonly _dir: Vec2;
    private readonly _maxRange: number;
    private readonly _maxRangeSqrd: number;

    private readonly _xyAxis: XYAxis;
    private readonly _rcAxis: RCAxis;
    private readonly _signAxis: SignAxis;

    private readonly _calcMajorAxisStep: (majorAxisStep: number) => Vec2;
    private readonly _calcMinorAxisStep: (minorAxisStep: number) => Vec2;

    constructor(srcPos: Vec2, dstPos: Vec2) {
        const deltaChange = dstPos.sub(srcPos);

        this._srcPos = srcPos;
        this._dstPos = dstPos;
        this._maxRange = deltaChange.length;
        this._maxRangeSqrd = this._maxRange * this._maxRange;

        const xMajorAxis = Math.abs(deltaChange.x) >= Math.abs(deltaChange.y);
        if (xMajorAxis) {
            this._xyAxis = { major: "x", minor: "y" };
            this._rcAxis = { major: "col", minor: "row" };

            {
                const dx = Math.sign(deltaChange.x);
                const dy = deltaChange.y / deltaChange.x;

                this._calcMajorAxisStep = (majorAxisStep) => {
                    const x = majorAxisStep * dx;
                    const y = x * dy;

                    return new Vec2({ x, y });
                };
            }

            {
                const dx = deltaChange.x / deltaChange.y;
                const dy = Math.sign(deltaChange.y);

                this._calcMinorAxisStep = (minorAxisStep) => {
                    const y = minorAxisStep * dy;
                    const x = y * dx;

                    return new Vec2({ x, y });
                };
            }
        } else {
            this._xyAxis = { major: "y", minor: "x" };
            this._rcAxis = { major: "row", minor: "col" };

            {
                const dx = deltaChange.x / deltaChange.y;
                const dy = Math.sign(deltaChange.y);

                this._calcMajorAxisStep = (majorAxisStep) => {
                    const y = majorAxisStep * dy;
                    const x = y * dx;

                    return new Vec2({ x, y });
                };
            }

            {
                const dx = Math.sign(deltaChange.x);
                const dy = deltaChange.y / deltaChange.x;

                this._calcMinorAxisStep = (minorAxisStep) => {
                    const x = minorAxisStep * dx;
                    const y = x * dy;

                    return new Vec2({ x, y });
                };
            }
        }

        this._dir = deltaChange.divide(this._maxRange);
        this._signAxis = {
            major: Math.sign(this._dir[this._xyAxis.major]),
            minor: Math.sign(this._dir[this._xyAxis.minor])
        };
    }

    get srcPos(): Vec2 {
        return this._srcPos;
    }

    get dstPos(): Vec2 {
        return this._dstPos;
    }

    get dir(): Vec2 {
        return this._dir;
    }

    get maxRange(): number {
        return this._maxRange;
    }

    get maxRangeSqrd(): number {
        return this._maxRangeSqrd;
    }

    get xyAxis(): XYAxis {
        return this._xyAxis;
    }

    get rcAxis(): RCAxis {
        return this._rcAxis;
    }

    get signAxis(): SignAxis {
        return this._signAxis;
    }

    get calcMajorAxisStep(): (majorAxisStep: number) => Vec2 {
        return this._calcMajorAxisStep;
    }

    get calcMinorAxisStep(): (minorAxisStep: number) => Vec2 {
        return this._calcMinorAxisStep;
    }

    private _visitTile(
        map: WorldMap,
        tilePos: TilePos,
        entryWorldPos: Vec2,
        exitWorldPos: Vec2,
        handleMaterialPenetration: HandleMaterialPenetration
    ) {
        if (map.isOutside(tilePos)) {
            return;
        }

        const { tileSize } = map;
        const threshold = 0.1;

        // Validate that the entry and exit points are inside the tile"s bounds.
        {
            const topLeft = tilePos.scale(tileSize).sub({ x: threshold, y: threshold });
            const bottomRight = topLeft
                .add({ x: tileSize, y: tileSize })
                .add({ x: threshold, y: threshold });

            if (
                entryWorldPos.x < topLeft.x ||
                entryWorldPos.y < topLeft.y ||
                entryWorldPos.x > bottomRight.x ||
                entryWorldPos.y > bottomRight.y
            ) {
                console.error("entryWorldPos not in expected tile");
            }
            if (
                exitWorldPos.x < topLeft.x ||
                exitWorldPos.y < topLeft.y ||
                exitWorldPos.x > bottomRight.x ||
                exitWorldPos.y > bottomRight.y
            ) {
                console.error("exitWorldPos not in expected tile");
            }
        }

        const tile = map.getTile(tilePos);

        return map.rayCastTile(tile, entryWorldPos, exitWorldPos, handleMaterialPenetration);
    }

    castRay(map: WorldMap, handleMaterialPenetration: HandleMaterialPenetration) {
        const { tileSize } = map;

        // Calculate the next point that we will cross a major axis tile boundary.
        const crossesTileOnMajorAxisAt =
            Math.floor(
                (this.srcPos[this.xyAxis.major] +
                    (this.dir[this.xyAxis.major] > 0 ? tileSize : 0)) /
                    tileSize
            ) * tileSize;
        // Calculate the amount we will be stepping along the major axis (+/- full tile width).
        const majorAxisStepAmount = this.signAxis.major * tileSize;

        let currentTilePos = map.worldToTile(this.srcPos);
        let currentMinorAxisTilePos = Math.floor(this.srcPos[this.xyAxis.minor] / tileSize);
        let majorAxisStep = crossesTileOnMajorAxisAt - this.srcPos[this.xyAxis.major];
        let previousSampleWorldPos = this.srcPos;

        let traceComplete = false;

        do {
            const majorAxisIntersectionDelta = this.calcMajorAxisStep(Math.abs(majorAxisStep));
            const majorAxisIntersectionWorldPos = this.srcPos.add(majorAxisIntersectionDelta);

            if (majorAxisIntersectionDelta.lengthSqrd > this.maxRangeSqrd) {
                traceComplete = true;
            } else {
                traceComplete = false;
            }

            const sampleInc = new TilePos({
                [this.rcAxis.major]: this.signAxis.major,
                [this.rcAxis.minor]: 0
            } as ITilePos); // TS doesn't fully understand the relationship, i.e. major/minor axis are XOR x/y.

            let finalPos: Vec2 | undefined;

            const minorAxisTilePos = Math.floor(
                majorAxisIntersectionWorldPos[this.xyAxis.minor] / tileSize
            );
            if (minorAxisTilePos !== currentMinorAxisTilePos) {
                sampleInc[this.rcAxis.minor] = this.signAxis.minor;

                // We have crossed a minor axis boundary too.
                const additionalTilePos = currentTilePos.add({
                    [this.rcAxis.major]: 0,
                    [this.rcAxis.minor]: sampleInc[this.rcAxis.minor]
                } as ITilePos);

                currentMinorAxisTilePos = minorAxisTilePos;

                // Calculate the intersection point on the minor axis.
                const minorAxisValue =
                    this.signAxis.minor > 0
                        ? additionalTilePos[this.rcAxis.minor] * tileSize
                        : additionalTilePos[this.rcAxis.minor] * tileSize + tileSize;
                const minorAxisIntersectionDelta = this.calcMinorAxisStep(
                    Math.abs(minorAxisValue - this.srcPos[this.xyAxis.minor])
                );
                const minorAxisIntersectionWorldPos = this.srcPos.add(minorAxisIntersectionDelta);

                // We might run out of ray length before the minor axis intersection OR the major axis intersection,
                // so we have to handle both cases to reliably hande the trace.
                if (!traceComplete) {
                    // Trace happliy makes both intersections.
                    finalPos = this._visitTile(
                        map,
                        currentTilePos,
                        previousSampleWorldPos,
                        minorAxisIntersectionWorldPos,
                        handleMaterialPenetration
                    );
                    if (finalPos) {
                        return finalPos;
                    }
                    finalPos = this._visitTile(
                        map,
                        additionalTilePos,
                        minorAxisIntersectionWorldPos,
                        majorAxisIntersectionWorldPos,
                        handleMaterialPenetration
                    );
                    if (finalPos) {
                        return finalPos;
                    }
                } else {
                    // Trace finishes before the next major axis intersection, so it either:
                    if (minorAxisIntersectionDelta.lengthSqrd < this.maxRangeSqrd) {
                        // Makes the minor intersection and then finishes, or:
                        finalPos = this._visitTile(
                            map,
                            currentTilePos,
                            previousSampleWorldPos,
                            minorAxisIntersectionWorldPos,
                            handleMaterialPenetration
                        );
                        if (finalPos) {
                            return finalPos;
                        }
                        finalPos = this._visitTile(
                            map,
                            additionalTilePos,
                            minorAxisIntersectionWorldPos,
                            this.dstPos,
                            handleMaterialPenetration
                        );
                        if (finalPos) {
                            return finalPos;
                        }
                    } else {
                        // Doesn"t make the minor axis intersection.
                        finalPos = this._visitTile(
                            map,
                            currentTilePos,
                            previousSampleWorldPos,
                            this.dstPos,
                            handleMaterialPenetration
                        );
                        if (finalPos) {
                            return finalPos;
                        }
                    }
                }
            } else {
                if (traceComplete) {
                    finalPos = this._visitTile(
                        map,
                        currentTilePos,
                        previousSampleWorldPos,
                        this.dstPos,
                        handleMaterialPenetration
                    );
                    if (finalPos) {
                        return finalPos;
                    }
                } else {
                    finalPos = this._visitTile(
                        map,
                        currentTilePos,
                        previousSampleWorldPos,
                        majorAxisIntersectionWorldPos,
                        handleMaterialPenetration
                    );
                    if (finalPos) {
                        return finalPos;
                    }
                }
            }

            currentTilePos = currentTilePos.add(sampleInc);
            majorAxisStep += majorAxisStepAmount;
            previousSampleWorldPos = majorAxisIntersectionWorldPos;

            if (map.isOutside(currentTilePos)) {
                traceComplete = true;

                // Traces that leave the world are extended so that they disappear nicely.
                previousSampleWorldPos = previousSampleWorldPos.add(this.dir.scale(tileSize * 2));
            }
        } while (!traceComplete);

        // Limit total length of trace to maxRange.
        const deltaChange = previousSampleWorldPos.sub(this.srcPos);
        const length = deltaChange.length;
        if (length > this.maxRange) {
            previousSampleWorldPos = this.srcPos.add(deltaChange.normalise().scale(this.maxRange));
        }

        // Final position.
        return previousSampleWorldPos;
    }
}
