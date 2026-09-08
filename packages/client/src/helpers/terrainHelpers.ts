import { Orientation } from "@atbs/maths";
import { randomOrientation, rotateOrientation } from "@atbs/maths";
import { SelectedTerrain, TerrainPaletteWire } from "@atbs/shared-data";

export function createDefaultSelectedTerrain(): SelectedTerrain {
    return {
        index: 0,
        orientation: Orientation.NORTH,
        randomiseOrientation: false,
        compoundTerrain: false,
        stackTerrain: false,
        // Prefer solid terrains for compound defaults (palette index 0 is Transparent).
        image1: {
            index: 1,
            orientation: Orientation.NORTH,
            randomiseOrientation: false
        },
        blend: {
            index: 0,
            orientation: Orientation.NORTH,
            randomiseOrientation: false
        },
        image2: {
            index: 2,
            orientation: Orientation.NORTH,
            randomiseOrientation: false
        }
    };
}

export function getTerrainId(
    terrainPalette: TerrainPaletteWire,
    selectedTerrain: SelectedTerrain,
    stopRandomise = false
): string | undefined {
    if (!selectedTerrain.compoundTerrain) {
        return terrainPalette.terrains[selectedTerrain.index]?.id;
    }

    const terrain1 = terrainPalette.terrains[selectedTerrain.image1.index];
    const terrain2 = terrainPalette.terrains[selectedTerrain.image2.index];
    const blend = terrainPalette.blends[selectedTerrain.blend.index];

    if (!terrain1 || !terrain2 || !blend) {
        return undefined;
    }

    const terrain1Id = terrain1.id.replace(".terrain", "");
    const terrain2Id = terrain2.id.replace(".terrain", "");

    if (terrain1Id === terrain2Id) {
        return undefined;
    }

    const blendId = blend.id.replace(".blend", "");
    const terrain1Orientation =
        selectedTerrain.image1.randomiseOrientation &&
        terrain1.allowRandomOrientation &&
        !stopRandomise
            ? randomOrientation()
            : selectedTerrain.image1.orientation;
    const terrain2Orientation =
        selectedTerrain.image2.randomiseOrientation &&
        terrain2.allowRandomOrientation &&
        !stopRandomise
            ? randomOrientation()
            : selectedTerrain.image2.orientation;
    const blendOrientation =
        selectedTerrain.blend.randomiseOrientation && !stopRandomise
            ? randomOrientation()
            : selectedTerrain.blend.orientation;

    return `${terrain1Id}[${terrain1Orientation}]_${blendId}[${blendOrientation}]_${terrain2Id}[${terrain2Orientation}].terrain`;
}

export function rotateCompoundLayer(
    selectedTerrain: SelectedTerrain,
    layer: "image1" | "blend" | "image2",
    steps: -2 | 2
): SelectedTerrain {
    return {
        ...selectedTerrain,
        [layer]: {
            ...selectedTerrain[layer],
            orientation: rotateOrientation(selectedTerrain[layer].orientation, steps)
        }
    };
}

export function getPaintOrientation(selectedTerrain: SelectedTerrain): Orientation {
    return selectedTerrain.orientation;
}

export function getPaintRandomiseOrientation(
    terrainPalette: TerrainPaletteWire,
    selectedTerrain: SelectedTerrain
): boolean {
    if (selectedTerrain.compoundTerrain) {
        return false;
    }

    const terrain = terrainPalette.terrains[selectedTerrain.index];
    return selectedTerrain.randomiseOrientation && !!terrain?.allowRandomOrientation;
}
