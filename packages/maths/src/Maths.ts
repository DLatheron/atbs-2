export function clamp(value: number, inclusiveMin: number = 0, inclusiveMax: number = 1) {
    return Math.max(Math.min(value, inclusiveMax), inclusiveMin);
}

export function wrap(value: number, inclusiveMin: number = 0, exclusiveMax: number = 1) {
    const range = exclusiveMax - inclusiveMin;
    return ((((value - inclusiveMin) % range) + range) % range) + inclusiveMin;
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function generateRandomBetween(min: number, max: number): number {
    const range = max - min;
    return min + Math.random() * range;
}

export function calcFalloff(
    amount: number,
    range: number,
    maxRange: number,
    dropOffPower = 9
): number {
    if (maxRange === 0) {
        return amount;
    } else {
        const clampedRange = Math.min(Math.max(range, 0), maxRange);
        const rangeFalloff = 1 - Math.pow(clampedRange / maxRange, dropOffPower);

        return amount * rangeFalloff;
    }
}

export function roundToScaleMidpoint(value: number, scale: number): number {
    return (Math.floor(value / scale) + 0.5) * scale;
}

export function roundToScale(value: number, scale: number): number {
    return Math.floor(value / scale) * scale;
}

export function calcProjectileIntegrity(
    integrity: number,
    velocity: number,
    materialHardness: number
): number {
    return Math.max(integrity - materialHardness * velocity * 0.001, 0);
}
