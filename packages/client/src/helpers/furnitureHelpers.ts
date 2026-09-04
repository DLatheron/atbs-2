import { IVec2, Orientation, Vec2, rotateOrientation } from "@atbs/maths";
import { FurniturePaletteWire, SelectedFurniture } from "@atbs/shared-data";

export function createDefaultSelectedFurniture(): SelectedFurniture {
    return {
        index: 0,
        orientation: Orientation.NORTH,
        randomiseOrientation: false
    };
}

export function rotateSample(pos: IVec2, dimensions: IVec2, orientation: Orientation): Vec2 {
    switch (orientation) {
        case Orientation.NORTH:
            return new Vec2(pos.x, pos.y);
        case Orientation.EAST:
            return new Vec2(dimensions.y - 1 - pos.y, pos.x);
        case Orientation.SOUTH:
            return new Vec2(dimensions.x - 1 - pos.x, dimensions.y - 1 - pos.y);
        case Orientation.WEST:
            return new Vec2(pos.y, dimensions.x - 1 - pos.x);
        default:
            return new Vec2(pos.x, pos.y);
    }
}

export function getFurnitureBrushSize(
    furniturePalette: FurniturePaletteWire,
    selectedFurniture: SelectedFurniture
): Vec2 {
    const entry = furniturePalette.furniture[selectedFurniture.index];
    if (!entry) {
        return new Vec2(1, 1);
    }

    return new Vec2(entry.furniture[0]?.length ?? 1, entry.furniture.length);
}

export function getFurnitureHoverSize(
    furniturePalette: FurniturePaletteWire,
    selectedFurniture: SelectedFurniture
): Vec2 {
    const brushSize = getFurnitureBrushSize(furniturePalette, selectedFurniture);

    if (
        selectedFurniture.orientation === Orientation.NORTH ||
        selectedFurniture.orientation === Orientation.SOUTH
    ) {
        return brushSize;
    }

    return new Vec2(brushSize.y, brushSize.x);
}

export function getFurniturePaletteEntryId(
    furniturePalette: FurniturePaletteWire,
    selectedFurniture: SelectedFurniture
): string | undefined {
    return furniturePalette.furniture[selectedFurniture.index]?.id;
}

export function getPaintRandomiseOrientation(
    furniturePalette: FurniturePaletteWire,
    selectedFurniture: SelectedFurniture
): boolean {
    const entry = furniturePalette.furniture[selectedFurniture.index];
    return selectedFurniture.randomiseOrientation && !!entry?.allowRandomOrientation;
}

export function getRotatedFurnitureDimensions(
    furniturePalette: FurniturePaletteWire,
    selectedFurniture: SelectedFurniture
): Vec2 {
    const entry = furniturePalette.furniture[selectedFurniture.index];
    if (!entry) {
        return new Vec2(1, 1);
    }

    const width = entry.furniture[0]?.length ?? 1;
    const height = entry.furniture.length;
    const dimensions = new Vec2(width, height);

    if (
        selectedFurniture.orientation === Orientation.NORTH ||
        selectedFurniture.orientation === Orientation.SOUTH
    ) {
        return dimensions;
    }

    return new Vec2(dimensions.y, dimensions.x);
}

export function getRotatedFurniturePreviewImages(
    furniturePalette: FurniturePaletteWire,
    selectedFurniture: SelectedFurniture
) {
    const entry = furniturePalette.furniture[selectedFurniture.index];
    if (!entry) {
        return [];
    }

    const dimensions = getRotatedFurnitureDimensions(furniturePalette, selectedFurniture);
    const images: {
        x: number;
        y: number;
        uiImage: (typeof entry.furniture)[number][number]["uiImage"];
    }[] = [];

    for (let y = 0; y < dimensions.y; y++) {
        for (let x = 0; x < dimensions.x; x++) {
            const samplePos = rotateSample({ x, y }, dimensions, selectedFurniture.orientation);
            images.push({
                x,
                y,
                uiImage: entry.furniture[samplePos.y][samplePos.x].uiImage
            });
        }
    }

    return images;
}

export function rotateFurnitureSelection(
    selectedFurniture: SelectedFurniture,
    steps: -2 | 2
): SelectedFurniture {
    return {
        ...selectedFurniture,
        orientation: rotateOrientation(selectedFurniture.orientation, steps)
    };
}
