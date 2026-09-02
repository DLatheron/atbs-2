export const MIN_MAP_SIZE = 32;
export const MAX_MAP_SIZE = 256;

export function isValidMapSetup(width: number, height: number): boolean {
    return (
        width >= MIN_MAP_SIZE &&
        width <= MAX_MAP_SIZE &&
        height >= MIN_MAP_SIZE &&
        height <= MAX_MAP_SIZE
    );
}

export function clampMapSize(value: number): number {
    return Math.min(MAX_MAP_SIZE, Math.max(MIN_MAP_SIZE, value));
}
