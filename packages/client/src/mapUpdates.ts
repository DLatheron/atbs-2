import {
    ClientMap,
    DeathAnimation,
    EditorMapWire,
    RenderList,
    RenderMode,
    SceneObject,
    TileUpdate,
    TimedTileUpdate
} from "@atbs/shared-data";
import { TilePos } from "@atbs/maths";
import { ImageCache } from "./ImageCache.js";

// `anim-` ids are animation instance placeholders resolved by AnimationController,
// not images the server can serve, so they must never reach the cache.
function isCacheableImageId(imageId: string): boolean {
    return !!imageId && !imageId.startsWith("anim-");
}

function imageIdsFromRenderList(renderList: RenderList): string[] {
    return renderList.flatMap(({ imageId }) => (isCacheableImageId(imageId) ? [imageId] : []));
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

function imageIdsFromDeathAnimations(deaths: DeathAnimation[]): string[] {
    return deaths.flatMap((death) => {
        const imageIds: string[] = [];

        new SceneObject(death.playAnimation.recipe.stateDef.renderable).forEachImageId(
            (imageId) => {
                if (isCacheableImageId(imageId)) {
                    imageIds.push(imageId);
                }
            }
        );

        return imageIds;
    });
}

/**
 * Load every image a fire trace will show before its timeline starts. Tile updates
 * carry sprites the server regenerated under an existing id (damaged furniture,
 * corpses), so those bytes must be refetched, whereas animation frames only need to
 * be present. Awaiting this keeps a swapped tile from rendering nothing while its
 * replacement is still in flight.
 */
export async function preloadTraceImages(
    imageCache: ImageCache,
    tileUpdates: TimedTileUpdate[],
    deaths: DeathAnimation[]
): Promise<void> {
    await Promise.all([
        imageCache.preloadImages(tileUpdates.flatMap(imageIdsFromTimedTileUpdate), {
            reload: true
        }),
        imageCache.preloadImages(imageIdsFromDeathAnimations(deaths))
    ]);
}

export function applyTileUpdate(map: ClientMap, update: TileUpdate, imageCache?: ImageCache): void {
    applyTimedTileUpdate(map, { ...update, timeMs: 0 }, imageCache);
}

export function applyTileUpdates(
    map: ClientMap,
    updates: TileUpdate[],
    imageCache?: ImageCache
): void {
    for (const update of updates) {
        applyTileUpdate(map, update, imageCache);
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

    if ("furnitureLayer" in map && update.furniture !== undefined) {
        (map as EditorMapWire).furnitureLayer[tilePos.row][tilePos.col] = update.furniture;
    }

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
