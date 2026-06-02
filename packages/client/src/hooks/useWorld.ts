import { ImageCache } from "../ImageCache";
import { World } from "../World";

const world = new World(ImageCache.GetSingleton());

export function useWorld() {
    return { world };
}
