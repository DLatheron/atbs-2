export const TILE_DRAW_BLEED_PX = 1;

export interface TileDrawDestRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Destination rect for a tile image drawn in local space after translating to
 * the tile centre (and optionally rotating).
 *
 * Dest size must stay centred. The previous `width/height + 1` overlap was
 * added only on +x/+y, so 90°/180°/270° rotations moved the extra pixel off
 * the shared edge and left a gap (black map background, or a seam through
 * multi-tile furniture such as trees).
 */
export function tileDrawDestRect(
    tileCanvasWidth: number,
    tileCanvasHeight: number,
    bleedPx = TILE_DRAW_BLEED_PX
): TileDrawDestRect {
    const width = tileCanvasWidth + bleedPx * 2;
    const height = tileCanvasHeight + bleedPx * 2;

    return {
        x: -width / 2,
        y: -height / 2,
        width,
        height
    };
}
