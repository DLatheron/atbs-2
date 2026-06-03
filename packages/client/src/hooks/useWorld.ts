import { World } from "../World";

export function useWorld() {
    return { world: World.GetSingleton() };
}
