import { ClientMap, RenderList, RenderMode, TimedTileUpdate } from "@atbs/shared-data";
import { TilePos } from "@atbs/maths";
import { ImageCache } from "./ImageCache.js";

function imageIdsFromRenderList(renderList: RenderList): string[] {
    return renderList.flatMap(({ imageId }) => (imageId ? [imageId] : []));
}

function imageIdsFromTimedTileUpdate(update: TimedTileUpdate): string[] {
    return [
        ...imageIdsFromRenderList(update.tileByRenderMode[RenderMode.enum.MAP_MODE]),
        ...imageIdsFromRenderList(update.tileByRenderMode[RenderMode.enum.FIRE_MODE])
    ];
}

export function refreshTimedTileUpdateImages(
    imageCache: ImageCache,
    update: TimedTileUpdate
): void {
    const uniqueImageIds = [...new Set(imageIdsFromTimedTileUpdate(update))];

    for (const imageId of uniqueImageIds) {
        if (imageCache.isLoaded(imageId)) {
            imageCache.reloadImage(imageId);
        } else {
            imageCache.requestImage(imageId);
        }
    }
}

export function applyTimedTileUpdate(
    map: ClientMap,
    update: TimedTileUpdate,
    imageCache?: ImageCache
): void {
    const tilePos = new TilePos(update.tilePos);

    map.tilesByRenderMode[RenderMode.enum.MAP_MODE][tilePos.row][tilePos.col] =
        update.tileByRenderMode[RenderMode.enum.MAP_MODE];
    map.tilesByRenderMode[RenderMode.enum.FIRE_MODE][tilePos.row][tilePos.col] =
        update.tileByRenderMode[RenderMode.enum.FIRE_MODE];

    if (imageCache) {
        refreshTimedTileUpdateImages(imageCache, update);
    }
}

export function applyTimedTileUpdates(
    map: ClientMap,
    updates: TimedTileUpdate[],
    imageCache?: ImageCache
): void {
    for (const update of updates) {
        applyTimedTileUpdate(map, update, imageCache);
    }
}
