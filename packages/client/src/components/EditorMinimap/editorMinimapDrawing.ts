import { TilePos } from "@atbs/maths";
import { EditorMapWire, RenderList, RenderMode } from "@atbs/shared-data";
import { ImageCache } from "../../ImageCache";
import type { EditorWorld } from "../../EditorWorld";

export function getMinimapTilePixelSize(mapWidth: number, containerWidth: number): number {
    const padding = 8;
    const availableWidth = Math.max(1, containerWidth - padding);
    return Math.max(1, Math.floor(availableWidth / mapWidth));
}

function collectImageIds(renderList: RenderList): string[] {
    return renderList
        .map(({ imageId }) => imageId)
        .filter((imageId) => !!imageId && !imageId.startsWith("anim-"));
}

export function drawMinimapTiles(
    context: CanvasRenderingContext2D,
    map: EditorMapWire,
    imageCache: ImageCache,
    tilePixelSize: number
) {
    const tiles = map.tilesByRenderMode[RenderMode.enum.MAP_MODE];

    for (let row = 0; row < map.height; row++) {
        for (let col = 0; col < map.width; col++) {
            const renderList = tiles[row]?.[col];
            if (!renderList) {
                continue;
            }

            const x = col * tilePixelSize;
            const y = row * tilePixelSize;
            let drewTile = false;

            for (const imageId of collectImageIds(renderList)) {
                imageCache.requestImage(imageId);
                if (!imageCache.isLoaded(imageId)) {
                    continue;
                }

                context.drawImage(imageCache.getImage(imageId), x, y, tilePixelSize, tilePixelSize);
                drewTile = true;
            }

            if (!drewTile) {
                context.fillStyle = "#3a3a3a";
                context.fillRect(x, y, tilePixelSize, tilePixelSize);
            }
        }
    }
}

export function drawMinimapViewport(
    context: CanvasRenderingContext2D,
    world: EditorWorld,
    tilePixelSize: number
) {
    if (!world.hasMap) {
        return;
    }

    const { start, end } = world.viewportInTileStartAndEnd();
    const x = start.col * tilePixelSize;
    const y = start.row * tilePixelSize;
    const width = (end.col - start.col + 1) * tilePixelSize;
    const height = (end.row - start.row + 1) * tilePixelSize;

    context.strokeStyle = "#ff4444";
    context.lineWidth = Math.max(1, tilePixelSize >= 4 ? 2 : 1);
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

export function clientPositionToTilePos(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
    map: EditorMapWire,
    tilePixelSize: number
): TilePos | undefined {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const col = Math.floor(x / tilePixelSize);
    const row = Math.floor(y / tilePixelSize);

    if (col < 0 || row < 0 || col >= map.width || row >= map.height) {
        return undefined;
    }

    return new TilePos(col, row);
}

export function minimapEventToTilePos(
    event: React.MouseEvent<HTMLCanvasElement>,
    map: EditorMapWire,
    tilePixelSize: number
): TilePos | undefined {
    return clientPositionToTilePos(
        event.currentTarget,
        event.clientX,
        event.clientY,
        map,
        tilePixelSize
    );
}
