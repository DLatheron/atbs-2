export const degreesToRadians = (deg: number): number => (Math.PI * deg) / 180;
export const radiansToDegrees = (rad: number): number => (rad * 180) / Math.PI;

export const RotateBy180Degrees = 4;
export const MaxOrientations = 8;

export enum Orientation {
    NORTH = 0,
    NORTH_EAST = 1,
    EAST = 2,
    SOUTH_EAST = 3,
    SOUTH = 4,
    SOUTH_WEST = 5,
    WEST = 6,
    NORTH_WEST = 7,

    CENTER = 8
}

export const OrientationToString = {
    [Orientation.NORTH]: "NORTH",
    [Orientation.NORTH_EAST]: "NORTH_EAST",
    [Orientation.EAST]: "EAST",
    [Orientation.SOUTH_EAST]: "SOUTH_EAST",
    [Orientation.SOUTH]: "SOUTH",
    [Orientation.SOUTH_WEST]: "SOUTH_WEST",
    [Orientation.WEST]: "WEST",
    [Orientation.NORTH_WEST]: "NORTH_WEST",
    [Orientation.CENTER]: "CENTER"
};

export const OrientationToRadians: Record<Orientation, number> = {
    [Orientation.NORTH]: 0,
    [Orientation.NORTH_EAST]: degreesToRadians(45),
    [Orientation.EAST]: degreesToRadians(90),
    [Orientation.SOUTH_EAST]: degreesToRadians(135),
    [Orientation.SOUTH]: degreesToRadians(180),
    [Orientation.SOUTH_WEST]: degreesToRadians(225),
    [Orientation.WEST]: degreesToRadians(270),
    [Orientation.NORTH_WEST]: degreesToRadians(315),
    [Orientation.CENTER]: NaN
};

export const OrientationToDegrees: Record<Orientation, number> = {
    [Orientation.NORTH]: 0,
    [Orientation.NORTH_EAST]: 45,
    [Orientation.EAST]: 90,
    [Orientation.SOUTH_EAST]: 135,
    [Orientation.SOUTH]: 180,
    [Orientation.SOUTH_WEST]: 225,
    [Orientation.WEST]: 270,
    [Orientation.NORTH_WEST]: 315,
    [Orientation.CENTER]: NaN
};

export function randomOrientation(orientations: 4 | 8 = 4) {
    const random = Math.floor(Math.random() * orientations);

    return orientations === 8 ? random : random * 2;
}

export function rotateOrientation(orientation: Orientation, add: number) {
    if (orientation === Orientation.CENTER || add === 0) {
        return orientation;
    }

    let direction: number = orientation + add;

    while (direction < Orientation.NORTH) {
        direction += Orientation.CENTER;
    }
    while (direction > Orientation.NORTH_WEST) {
        direction -= Orientation.CENTER;
    }

    return direction as Orientation;
}

export function relativeDirection(
    orientation: Orientation,
    targetOrientation: Orientation
): number {
    if (orientation === Orientation.CENTER) {
        return orientation;
    }

    const difference = targetOrientation - orientation;
    if (difference > 4) {
        return -(8 - difference);
    } else if (difference < -4) {
        return 8 + difference;
    } else {
        return difference;
    }
}

export const OrientationToCSSTransform = {
    [Orientation.NORTH]: "rotate(0deg)",
    [Orientation.NORTH_EAST]: "rotate(45deg)",
    [Orientation.EAST]: "rotate(90deg)",
    [Orientation.SOUTH_EAST]: "rotate(135deg)",
    [Orientation.SOUTH]: "rotate(180deg)",
    [Orientation.SOUTH_WEST]: "rotate(225deg)",
    [Orientation.WEST]: "rotate(270deg)",
    [Orientation.NORTH_WEST]: "rotate(315deg)",
    [Orientation.CENTER]: "rotate(0deg)"
};

export function roundDegrees(angleInDegrees: number) {
    return Math.floor((angleInDegrees + 45 / 2) / 45) * 45;
}

export function clampAngleInDegrees(angleInDegrees: number) {
    return angleInDegrees < 0 ? 360 + angleInDegrees : angleInDegrees;
}

export function angleInDegreesToDirection(angleInDegrees: number) {
    return Math.floor(clampAngleInDegrees(roundDegrees(angleInDegrees)) / 45) % MaxOrientations;
}

export function angleInDegreesToOrientation(angleInDegrees: number): Orientation {
    return Math.floor(clampAngleInDegrees(roundDegrees(angleInDegrees)) / 45) % MaxOrientations;
}

export function directionToDegrees(direction: number) {
    return direction * 45.0;
}
