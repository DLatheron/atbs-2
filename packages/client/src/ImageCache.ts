import { ClientMap, ImageId, RenderList, RenderMode } from "@atbs/shared-data";

export interface ImageDetails {
    image: HTMLImageElement;
    blob: Blob;
    dataString: string;
}

export const embeddedBlankImage = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

async function fetchImage(id: string): Promise<Blob> {
    const url = `/api/image/${id}`;
    const res = await fetch(url, { method: "GET" });
    const blob = await res.blob();

    return blob;
}

export class ImageCache {
    private readonly _idToDetails: Record<string, ImageDetails>;

    constructor() {
        this._idToDetails = {};
    }

    exists(id: string): boolean {
        return !!this._idToDetails[id];
    }

    async cache(imageOrImages: string | string[] | Set<string>) {
        if (typeof imageOrImages === "string") {
            return this._cache(imageOrImages);
        } else {
            const cacheTasks = Array.from(imageOrImages).map((id) => this._cache(id));
            return Promise.all(cacheTasks);
        }
    }

    private async _cache(id: string) {
        const entry = this._idToDetails[id];
        if (!entry) {
            const blob = await fetchImage(id);
            const image = new Image();
            image.src = URL.createObjectURL(blob);

            this._idToDetails[id] = {
                image,
                blob,
                dataString: URL.createObjectURL(blob)
            };

            console.info(`Cached Image: ${id}`);
        }
    }

    private _getImageDetails(id: string): ImageDetails {
        const details = this._idToDetails[id];
        if (!details) {
            throw new Error(`Image "${id}" not cached`);
        }
        return details;
    }

    getImage(id: string): HTMLImageElement {
        return this._getImageDetails(id).image;
    }

    getData(id: string) {
        return this._getImageDetails(id).dataString;
    }

    getDataSafe(id: string | null) {
        if (!id) {
            return embeddedBlankImage;
        }

        const details = this._idToDetails[id];
        if (!details) {
            return embeddedBlankImage;
        }

        return details.dataString;
    }

    async waitForImagesToCache(imageSet: Set<ImageId>) {
        const cacheTasks = Array.from(imageSet).map((id) => this.cache(id));
        await Promise.all(cacheTasks);
    }

    static CacheRenderListImages(renderList: RenderList, imageIdSet: Set<ImageId>) {
        renderList.forEach(({ imageId }) => imageId && imageIdSet.add(imageId));
    }

    static CacheClientMapImages(map: ClientMap) {
        const imageIdSet = new Set<ImageId>();

        map.tilesByRenderMode[RenderMode.enum.MAP_MODE].forEach((rowOfTiles: RenderList[]) =>
            rowOfTiles.forEach((renderList: RenderList) =>
                ImageCache.CacheRenderListImages(renderList, imageIdSet)
            )
        );

        return imageIdSet;
    }

    private static readonly _singleton = new ImageCache();
    static GetSingleton(): ImageCache {
        return ImageCache._singleton;
    }
}
