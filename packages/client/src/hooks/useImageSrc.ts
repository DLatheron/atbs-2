import { useEffect, useState } from "react";
import { ImageCache } from "../ImageCache";

export function useImageSrc(imageId: string | null | undefined): string {
    const [, bumpVersion] = useState(0);
    const imageCache = ImageCache.GetSingleton();

    useEffect(() => {
        if (!imageId) {
            return;
        }

        imageCache.requestImage(imageId);

        return imageCache.subscribe(imageId, () => {
            bumpVersion((version) => version + 1);
        });
    }, [imageCache, imageId]);

    return imageCache.getSrc(imageId);
}
