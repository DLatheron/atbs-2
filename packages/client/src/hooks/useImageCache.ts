import { ImageCache } from "../ImageCache";

export function useImageCache() {
    return { imageCache: ImageCache.GetSingleton() };
}
