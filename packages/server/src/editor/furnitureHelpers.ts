import { IVec2, Orientation, TilePos, Vec2, rotateOrientation } from "@atbs/maths";

export function rotateSample(pos: IVec2, dimensions: IVec2, orientation: Orientation): Vec2 {
    switch (orientation) {
        case Orientation.NORTH:
            return new Vec2(pos.x, pos.y);
        case Orientation.EAST:
            return new Vec2(dimensions.y - 1 - pos.y, pos.x);
        case Orientation.SOUTH:
            return new Vec2(dimensions.x - 1 - pos.x, dimensions.y - 1 - pos.y);
        case Orientation.WEST:
            return new Vec2(pos.y, dimensions.x - 1 - pos.x);
        default:
            return new Vec2(pos.x, pos.y);
    }
}

export function iterateFurnitureTiles(
    dimensions: IVec2,
    callback: (pos: IVec2) => void
): void {
    for (let y = 0; y < dimensions.y; y++) {
        for (let x = 0; x < dimensions.x; x++) {
            callback({ x, y });
        }
    }
}

export function getBrushDimensions(
    brushSize: IVec2,
    brushOrientation: Orientation
): Vec2 {
    return brushOrientation === Orientation.NORTH || brushOrientation === Orientation.SOUTH
        ? new Vec2(brushSize.x, brushSize.y)
        : new Vec2(brushSize.y, brushSize.x);
}

export function getAffectedTilePositions(
    origin: TilePos,
    brushSize: IVec2,
    brushOrientation: Orientation
): TilePos[] {
    const dimensions = getBrushDimensions(brushSize, brushOrientation);
    const positions: TilePos[] = [];

    iterateFurnitureTiles(dimensions, (tileXY) => {
        positions.push(origin.add(tileXY));
    });

    return positions;
}

export function resolveTileOrientation(
    baseOrientation: Orientation,
    placementOrientation: Orientation
): Orientation {
    return rotateOrientation(Orientation.NORTH, baseOrientation - placementOrientation);
}

export function resolveFurnitureTileOrientation(
    baseOrientation: Orientation,
    placementOrientation: Orientation,
    isMultiTile: boolean
): Orientation {
    if (!isMultiTile) {
        return placementOrientation;
    }

    return resolveTileOrientation(baseOrientation, placementOrientation);
}
