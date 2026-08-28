import { ImageCache } from "./ImageCache";
import { World } from "./World";

export class GameWorld extends World {
    private static readonly _singleton = new GameWorld(ImageCache.GetSingleton());

    static GetSingleton(): GameWorld {
        return GameWorld._singleton;
    }
}
