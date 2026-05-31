import { World } from "../World";

const world = new World();

export function useWorld() {
    return { world };
}
