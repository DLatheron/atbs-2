import { ITilePos, Vec2 } from "@atbs/maths";
import type { Camera2d } from "../../Camera2d.js";

export const EDITOR_HOVER_TILE_BORDER_COLOR = "#1e90ff";

export function drawEditorHoverTileOutline(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    camera: Camera2d,
    tilePos: ITilePos,
    tileSize: number,
    tileWidth: number,
    tileHeight: number,
    scale: { x: number },
    offset: Vec2,
    time: number
): void {
    const worldPos = new Vec2(tilePos.col * tileSize, tilePos.row * tileSize);
    const canvasPos = camera.worldToCanvas(worldPos);
    const tileCanvasSize = tileSize * scale.x;
    const outlineWidth = tileCanvasSize * tileWidth;
    const outlineHeight = tileCanvasSize * tileHeight;
    const half = tileCanvasSize / 2;
    const left = canvasPos.x + offset.x - half;
    const top = canvasPos.y + offset.y - half;

    const dashLength = Math.max(6, tileCanvasSize * 0.12);
    const dashPattern = [dashLength, dashLength * 0.75];
    const dashPeriod = dashLength + dashPattern[1];

    context.save();
    context.strokeStyle = EDITOR_HOVER_TILE_BORDER_COLOR;
    context.lineWidth = Math.max(2, tileCanvasSize * 0.06);
    context.lineCap = "round";
    context.setLineDash(dashPattern);
    context.lineDashOffset = -(time * 0.06) % dashPeriod;
    context.strokeRect(left, top, outlineWidth, outlineHeight);
    context.restore();
}
