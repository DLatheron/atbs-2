import { fromTilePosString, ITilePos, toTilePosString } from "@atbs/maths";

export interface TileRectangle {
    col: number;
    row: number;
    width: number;
    height: number;
}

export function tilesToMinimalRectangles(tiles: Iterable<ITilePos>): TileRectangle[] {
    const remaining = new Set<string>();
    for (const tile of tiles) {
        remaining.add(toTilePosString(tile));
    }

    const rectangles: TileRectangle[] = [];

    while (remaining.size > 0) {
        const firstKey = remaining.values().next().value;
        if (!firstKey) {
            break;
        }

        const { col, row } = fromTilePosString(firstKey);

        let width = 1;
        while (remaining.has(toTilePosString({ col: col + width, row }))) {
            width++;
        }

        let height = 1;
        while (true) {
            let rowComplete = true;
            for (let c = col; c < col + width; c++) {
                if (!remaining.has(toTilePosString({ col: c, row: row + height }))) {
                    rowComplete = false;
                    break;
                }
            }
            if (!rowComplete) {
                break;
            }
            height++;
        }

        for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
                remaining.delete(toTilePosString({ col: c, row: r }));
            }
        }

        rectangles.push({ col, row, width, height });
    }

    return rectangles;
}

export function rectanglesToTileKeys(rectangles: TileRectangle[]): string[] {
    const keys: string[] = [];

    for (const { col, row, width, height } of rectangles) {
        for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
                keys.push(toTilePosString({ col: c, row: r }));
            }
        }
    }

    return keys;
}
