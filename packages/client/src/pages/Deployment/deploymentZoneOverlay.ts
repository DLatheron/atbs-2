import { colourToRGBA, fromTilePosString, ITilePos, toTilePosString, Vec2 } from "@atbs/maths";
import { DeploymentZoneSummary } from "@atbs/shared-data";
import type { Camera2d } from "../../Camera2d.js";

type ZoneSummary = DeploymentZoneSummary[number];

interface CanvasPoint {
    x: number;
    y: number;
}

interface CanvasSegment {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

export function deploymentZoneHasConstraint(zone: {
    minUnits?: number;
    maxUnits?: number;
}): boolean {
    return zone.minUnits != null || zone.maxUnits != null;
}

export function minUnitsRequirementLabel(minUnits: number): string {
    return minUnits === 1 ? "1 Unit" : `${minUnits} Units`;
}

function worldCornerToCanvas(
    camera: Camera2d,
    worldX: number,
    worldY: number,
    tileSize: number,
    scale: { x: number },
    offset: Vec2
): CanvasPoint {
    const canvasPos = camera.worldToCanvas(new Vec2(worldX, worldY));
    const half = (tileSize * scale.x) / 2;
    return {
        x: canvasPos.x + offset.x - half,
        y: canvasPos.y + offset.y - half
    };
}

function collectZonePerimeterSegments(allTiles: Set<string>): CanvasSegment[] {
    const segments: CanvasSegment[] = [];

    for (const tileString of allTiles) {
        const { col, row } = fromTilePosString(tileString);

        if (!allTiles.has(toTilePosString({ col, row: row - 1 }))) {
            segments.push({ x0: col, y0: row, x1: col + 1, y1: row });
        }
        if (!allTiles.has(toTilePosString({ col: col + 1, row }))) {
            segments.push({ x0: col + 1, y0: row, x1: col + 1, y1: row + 1 });
        }
        if (!allTiles.has(toTilePosString({ col, row: row + 1 }))) {
            segments.push({ x0: col + 1, y0: row + 1, x1: col, y1: row + 1 });
        }
        if (!allTiles.has(toTilePosString({ col: col - 1, row }))) {
            segments.push({ x0: col, y0: row + 1, x1: col, y1: row });
        }
    }

    return segments;
}

function zoneCentroidCanvas(
    allTiles: Set<string>,
    camera: Camera2d,
    tileSize: number,
    offset: Vec2
): CanvasPoint | null {
    if (allTiles.size === 0) {
        return null;
    }

    let sumX = 0;
    let sumY = 0;

    for (const tileString of allTiles) {
        const { col, row } = fromTilePosString(tileString);
        const canvasPos = camera.worldToCanvas(new Vec2(col * tileSize, row * tileSize));
        sumX += canvasPos.x + offset.x;
        sumY += canvasPos.y + offset.y;
    }

    return {
        x: sumX / allTiles.size,
        y: sumY / allTiles.size
    };
}

export function drawDeploymentZoneConstraintOutline(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    zone: ZoneSummary,
    camera: Camera2d,
    tileSize: number,
    scale: { x: number },
    offset: Vec2,
    time: number
): void {
    if (!deploymentZoneHasConstraint(zone) || !zone.outlineColor) {
        return;
    }

    const tileCanvasSize = tileSize * scale.x;
    const footprint = zoneFootprintTiles(zone);
    const segments = collectZonePerimeterSegments(footprint);
    if (segments.length === 0) {
        return;
    }

    const strokeColor = colourToRGBA(zone.outlineColor);
    const dashLength = Math.max(6, tileCanvasSize * 0.12);
    const dashPattern = [dashLength, dashLength * 0.75];

    context.save();
    context.strokeStyle = strokeColor;
    context.lineWidth = Math.max(2, tileCanvasSize * 0.06);
    context.setLineDash(dashPattern);
    context.lineDashOffset = -(time * 0.06) % (dashLength + dashPattern[1]);
    context.lineCap = "round";

    context.beginPath();
    for (const segment of segments) {
        const start = worldCornerToCanvas(
            camera,
            segment.x0 * tileSize,
            segment.y0 * tileSize,
            tileSize,
            scale,
            offset
        );
        const end = worldCornerToCanvas(
            camera,
            segment.x1 * tileSize,
            segment.y1 * tileSize,
            tileSize,
            scale,
            offset
        );
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
    }
    context.stroke();
    context.restore();
}

export function drawDeploymentZoneMinUnitsLabel(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    zone: ZoneSummary,
    camera: Camera2d,
    tileSize: number,
    scale: { x: number },
    offset: Vec2
): void {
    if (zone.minUnits == null || zone.deployedCount >= zone.minUnits || !zone.outlineColor) {
        return;
    }

    const center = zoneCentroidCanvas(zoneFootprintTiles(zone), camera, tileSize, offset);
    if (!center) {
        return;
    }

    const tileCanvasSize = tileSize * scale.x;
    const fontSize = Math.max(12, Math.round(tileCanvasSize * 0.28));
    const label = minUnitsRequirementLabel(zone.minUnits);
    const fillColor = colourToRGBA(zone.outlineColor);

    context.save();
    context.font = `600 ${fontSize}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(0, 0, 0, 0.55)";
    context.fillText(label, center.x + 1, center.y + 1);
    context.fillStyle = fillColor;
    context.fillText(label, center.x, center.y);
    context.restore();
}

export function zoneFootprintTiles(zone: {
    allTiles: Set<string>;
    tiles: Set<string>;
}): Set<string> {
    return zone.allTiles.size > 0 ? zone.allTiles : zone.tiles;
}

export function allTilesFromWire(tiles: ITilePos[] | undefined): Set<string> {
    return new Set((tiles ?? []).map((tile) => toTilePosString(tile)));
}
