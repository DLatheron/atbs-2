import { Box, FormControlLabel, IconButton, Switch, Tab, Tabs, Typography } from "@mui/material";
import { Orientation, rotateOrientation } from "@atbs/maths";
import {
    BlendPaletteEntry,
    RenderImage,
    RenderList,
    SelectedTerrain,
    TerrainPaletteEntry,
    TerrainPaletteWire
} from "@atbs/shared-data";
import { useEffect, useMemo, useState } from "react";
import { ImageComponent } from "../Image";
import { PaletteFilters } from "../PaletteFilters";
import { getTerrainId, rotateCompoundLayer } from "../../helpers/terrainHelpers";
import {
    PALETTE_FILTER_ALL,
    itemMatchesPaletteFilters,
    uniqueSorted
} from "../../helpers/paletteFilters";
import { useImageCache } from "../../hooks/useImageCache";

const TILE_SIZE = 72;

export interface TerrainPanelProps {
    terrainPalette: TerrainPaletteWire;
    selectedTerrain: SelectedTerrain;
    onSelectedTerrainChange: (selectedTerrain: SelectedTerrain) => void;
}

interface PaletteGridItem {
    id: string;
    uiImage: RenderList;
    paletteIndex: number;
}

interface ImageSelectionGridProps {
    items: PaletteGridItem[];
    selectedIndex: number;
    orientation: Orientation;
    blendMask?: boolean;
    onSelectionChanged: (selection: { index: number; orientation: Orientation }) => void;
}

function ImageSelectionGrid({
    items,
    selectedIndex,
    orientation,
    blendMask = false,
    onSelectionChanged
}: ImageSelectionGridProps) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
                maxHeight: 240,
                overflowY: "auto"
            }}
        >
            {items.map((item) => {
                const selected = item.paletteIndex === selectedIndex;
                return (
                    <Box
                        key={item.id}
                        onClick={() =>
                            onSelectionChanged({ index: item.paletteIndex, orientation })
                        }
                        sx={{
                            border: selected ? "2px solid #1e90ff" : "1px solid #ccc",
                            cursor: "pointer",
                            p: 0.5
                        }}
                    >
                        <ImageComponent
                            images={item.uiImage.map((image) => ({
                                ...image,
                                orientation: rotateOrientation(
                                    image.orientation ?? Orientation.NORTH,
                                    orientation
                                )
                            }))}
                            width={TILE_SIZE}
                            height={TILE_SIZE}
                            blendMask={blendMask}
                        />
                    </Box>
                );
            })}
        </Box>
    );
}

function RandomiseToggle({
    checked,
    disabled,
    onChange
}: {
    checked: boolean;
    disabled: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <FormControlLabel
            sx={{
                ml: 0,
                mr: 0,
                boxSizing: "border-box"
            }}
            control={
                <Switch
                    size="small"
                    checked={checked}
                    disabled={disabled}
                    onChange={(_event, value) => onChange(value)}
                />
            }
            label="Randomise Orientation"
        />
    );
}

function LayerOrientationControls({
    orientation,
    randomise,
    randomiseDisabled = false,
    showRandomise = true,
    onRotate,
    onRandomiseChange
}: {
    orientation: Orientation;
    randomise?: boolean;
    randomiseDisabled?: boolean;
    showRandomise?: boolean;
    onRotate: (steps: -2 | 2) => void;
    onRandomiseChange?: (checked: boolean) => void;
}) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <IconButton size="small" disabled={!!randomise} onClick={() => onRotate(-2)}>
                    ↺
                </IconButton>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ minWidth: 72, textAlign: "center" }}
                >
                    {randomise ? "Random" : `${orientation * 45}°`}
                </Typography>
                <IconButton size="small" disabled={!!randomise} onClick={() => onRotate(2)}>
                    ↻
                </IconButton>
            </Box>
            {showRandomise && onRandomiseChange ? (
                <RandomiseToggle
                    checked={!!randomise}
                    disabled={randomiseDisabled}
                    onChange={onRandomiseChange}
                />
            ) : null}
        </Box>
    );
}

function toBlendGridItems(terrainPalette: TerrainPaletteWire): PaletteGridItem[] {
    return terrainPalette.blends.map((item: BlendPaletteEntry, paletteIndex: number) => ({
        id: item.id,
        uiImage: item.uiImage,
        paletteIndex
    }));
}

function SimpleTerrain({
    terrainPalette,
    selectedTerrain,
    onSelectedTerrainChange,
    visibleTerrains
}: TerrainPanelProps & { visibleTerrains: PaletteGridItem[] }) {
    const terrain = terrainPalette.terrains[selectedTerrain.index];

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <ImageSelectionGrid
                items={visibleTerrains}
                selectedIndex={selectedTerrain.index}
                orientation={selectedTerrain.orientation}
                onSelectionChanged={({ index, orientation }) => {
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        index,
                        orientation
                    });
                }}
            />
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <IconButton
                    size="small"
                    onClick={() =>
                        onSelectedTerrainChange({
                            ...selectedTerrain,
                            orientation: rotateOrientation(selectedTerrain.orientation, -2)
                        })
                    }
                >
                    ↺
                </IconButton>
                <ImageComponent
                    images={
                        terrain?.uiImage.map((image: RenderImage) => ({
                            ...image,
                            orientation: rotateOrientation(
                                image.orientation ?? Orientation.NORTH,
                                selectedTerrain.orientation
                            )
                        })) ?? []
                    }
                    width={100}
                    height={100}
                />
                <IconButton
                    size="small"
                    onClick={() =>
                        onSelectedTerrainChange({
                            ...selectedTerrain,
                            orientation: rotateOrientation(selectedTerrain.orientation, 2)
                        })
                    }
                >
                    ↻
                </IconButton>
            </Box>
            <RandomiseToggle
                checked={selectedTerrain.randomiseOrientation && !!terrain?.allowRandomOrientation}
                disabled={!terrain?.allowRandomOrientation}
                onChange={(checked) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        randomiseOrientation: checked
                    })
                }
            />
            <FormControlLabel
                sx={{ ml: 0, mr: 0, boxSizing: "border-box" }}
                control={
                    <Switch
                        size="small"
                        checked={selectedTerrain.stackTerrain}
                        onChange={(_event, checked) =>
                            onSelectedTerrainChange({
                                ...selectedTerrain,
                                stackTerrain: checked
                            })
                        }
                    />
                }
                label="Stack on existing terrain"
            />
        </Box>
    );
}

function CompoundTerrain({
    terrainPalette,
    selectedTerrain,
    onSelectedTerrainChange,
    visibleTerrains
}: TerrainPanelProps & { visibleTerrains: PaletteGridItem[] }) {
    const previewImageId = getTerrainId(terrainPalette, selectedTerrain, true);
    const terrain1 = terrainPalette.terrains[selectedTerrain.image1.index];
    const terrain2 = terrainPalette.terrains[selectedTerrain.image2.index];

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="subtitle2">Preview</Typography>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <IconButton
                    size="small"
                    disabled={!previewImageId}
                    onClick={() =>
                        onSelectedTerrainChange({
                            ...selectedTerrain,
                            orientation: rotateOrientation(selectedTerrain.orientation, -2)
                        })
                    }
                >
                    ↺
                </IconButton>
                <ImageComponent
                    images={
                        previewImageId
                            ? [
                                  {
                                      imageId: previewImageId,
                                      orientation: selectedTerrain.orientation
                                  }
                              ]
                            : []
                    }
                    width={100}
                    height={100}
                    disabled={!previewImageId}
                    checkerboard
                />
                <IconButton
                    size="small"
                    disabled={!previewImageId}
                    onClick={() =>
                        onSelectedTerrainChange({
                            ...selectedTerrain,
                            orientation: rotateOrientation(selectedTerrain.orientation, 2)
                        })
                    }
                >
                    ↻
                </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                Preview rotate spins the finished blend on the tile. Use the controls under each
                layer to bake orientation into the compound.
            </Typography>

            <FormControlLabel
                sx={{ ml: 0, mr: 0, boxSizing: "border-box" }}
                control={
                    <Switch
                        size="small"
                        checked={selectedTerrain.stackTerrain}
                        onChange={(_event, checked) =>
                            onSelectedTerrainChange({
                                ...selectedTerrain,
                                stackTerrain: checked
                            })
                        }
                    />
                }
                label="Stack on existing terrain"
            />

            <Typography variant="subtitle2">Background</Typography>
            <ImageSelectionGrid
                items={visibleTerrains}
                selectedIndex={selectedTerrain.image1.index}
                orientation={selectedTerrain.image1.orientation}
                onSelectionChanged={({ index, orientation }) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        image1: { ...selectedTerrain.image1, index, orientation }
                    })
                }
            />
            <LayerOrientationControls
                orientation={selectedTerrain.image1.orientation}
                randomise={
                    selectedTerrain.image1.randomiseOrientation &&
                    !!terrain1?.allowRandomOrientation
                }
                randomiseDisabled={!terrain1?.allowRandomOrientation}
                onRotate={(steps) =>
                    onSelectedTerrainChange(rotateCompoundLayer(selectedTerrain, "image1", steps))
                }
                onRandomiseChange={(checked) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        image1: { ...selectedTerrain.image1, randomiseOrientation: checked }
                    })
                }
            />

            <Typography variant="subtitle2">Blend</Typography>
            <ImageSelectionGrid
                items={toBlendGridItems(terrainPalette)}
                selectedIndex={selectedTerrain.blend.index}
                orientation={selectedTerrain.blend.orientation}
                blendMask
                onSelectionChanged={({ index, orientation }) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        blend: { ...selectedTerrain.blend, index, orientation }
                    })
                }
            />
            <LayerOrientationControls
                orientation={selectedTerrain.blend.orientation}
                randomise={selectedTerrain.blend.randomiseOrientation}
                onRotate={(steps) =>
                    onSelectedTerrainChange(rotateCompoundLayer(selectedTerrain, "blend", steps))
                }
                onRandomiseChange={(checked) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        blend: { ...selectedTerrain.blend, randomiseOrientation: checked }
                    })
                }
            />

            <Typography variant="subtitle2">Foreground</Typography>
            <ImageSelectionGrid
                items={visibleTerrains}
                selectedIndex={selectedTerrain.image2.index}
                orientation={selectedTerrain.image2.orientation}
                onSelectionChanged={({ index, orientation }) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        image2: { ...selectedTerrain.image2, index, orientation }
                    })
                }
            />
            <LayerOrientationControls
                orientation={selectedTerrain.image2.orientation}
                randomise={
                    selectedTerrain.image2.randomiseOrientation &&
                    !!terrain2?.allowRandomOrientation
                }
                randomiseDisabled={!terrain2?.allowRandomOrientation}
                onRotate={(steps) =>
                    onSelectedTerrainChange(rotateCompoundLayer(selectedTerrain, "image2", steps))
                }
                onRandomiseChange={(checked) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        image2: { ...selectedTerrain.image2, randomiseOrientation: checked }
                    })
                }
            />
        </Box>
    );
}

export function TerrainPanel({
    terrainPalette,
    selectedTerrain,
    onSelectedTerrainChange
}: TerrainPanelProps) {
    const imageCache = useImageCache().imageCache;
    const tab = selectedTerrain.compoundTerrain ? 1 : 0;
    const [selectedTileSets, setSelectedTileSets] = useState([PALETTE_FILTER_ALL]);
    const [selectedCategories, setSelectedCategories] = useState([PALETTE_FILTER_ALL]);

    const tileSetOptions = useMemo(
        () =>
            uniqueSorted(
                terrainPalette.terrains.map((terrain: TerrainPaletteEntry) => terrain.tileSet)
            ),
        [terrainPalette.terrains]
    );
    const categoryOptions = useMemo(
        () =>
            uniqueSorted(
                terrainPalette.terrains.map((terrain: TerrainPaletteEntry) => terrain.category)
            ),
        [terrainPalette.terrains]
    );
    const visibleTerrains = useMemo(
        () =>
            terrainPalette.terrains.flatMap((terrain: TerrainPaletteEntry, paletteIndex: number) =>
                itemMatchesPaletteFilters(terrain, selectedTileSets, selectedCategories)
                    ? [{ id: terrain.id, uiImage: terrain.uiImage, paletteIndex }]
                    : []
            ),
        [terrainPalette.terrains, selectedTileSets, selectedCategories]
    );

    /** Compound bg/fg grids always keep Transparent available even when filters hide Utility. */
    const compoundVisibleTerrains = useMemo(() => {
        const transparentIndex = terrainPalette.terrains.findIndex(
            (terrain: TerrainPaletteEntry) => terrain.id === "transparent.terrain"
        );
        if (transparentIndex < 0) {
            return visibleTerrains;
        }

        const alreadyVisible = visibleTerrains.some(
            (item: PaletteGridItem) => item.paletteIndex === transparentIndex
        );
        if (alreadyVisible) {
            return visibleTerrains;
        }

        const transparent = terrainPalette.terrains[transparentIndex];
        return [
            {
                id: transparent.id,
                uiImage: transparent.uiImage,
                paletteIndex: transparentIndex
            },
            ...visibleTerrains
        ];
    }, [terrainPalette.terrains, visibleTerrains]);

    const previewImageId = useMemo(
        () => getTerrainId(terrainPalette, selectedTerrain, true),
        [terrainPalette, selectedTerrain]
    );

    useEffect(() => {
        if (previewImageId) {
            imageCache.requestImage(previewImageId);
        }
    }, [imageCache, previewImageId]);

    useEffect(() => {
        const layerTerrains = selectedTerrain.compoundTerrain
            ? compoundVisibleTerrains
            : visibleTerrains;
        if (layerTerrains.length === 0) {
            return;
        }

        const visibleIndexes = new Set(
            layerTerrains.map((item: PaletteGridItem) => item.paletteIndex)
        );
        const solidFallback =
            layerTerrains.find((item: PaletteGridItem) => item.id !== "transparent.terrain")
                ?.paletteIndex ?? layerTerrains[0].paletteIndex;
        const next = { ...selectedTerrain };
        let changed = false;

        if (!selectedTerrain.compoundTerrain && !visibleIndexes.has(selectedTerrain.index)) {
            next.index = solidFallback;
            changed = true;
        }
        if (selectedTerrain.compoundTerrain) {
            if (!visibleIndexes.has(selectedTerrain.image1.index)) {
                next.image1 = { ...selectedTerrain.image1, index: solidFallback };
                changed = true;
            }
            if (!visibleIndexes.has(selectedTerrain.image2.index)) {
                next.image2 = { ...selectedTerrain.image2, index: solidFallback };
                changed = true;
            }
        }

        if (changed) {
            onSelectedTerrainChange(next);
        }
    }, [onSelectedTerrainChange, selectedTerrain, visibleTerrains, compoundVisibleTerrains]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%" }}>
            <Tabs
                value={tab}
                onChange={(_event, value: number) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        compoundTerrain: value === 1
                    })
                }
                variant="fullWidth"
            >
                <Tab label="Simple" />
                <Tab label="Compound" />
            </Tabs>

            <PaletteFilters
                tileSetOptions={tileSetOptions}
                categoryOptions={categoryOptions}
                selectedTileSets={selectedTileSets}
                selectedCategories={selectedCategories}
                onTileSetsChange={setSelectedTileSets}
                onCategoriesChange={setSelectedCategories}
            />

            <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
                {tab === 0 ? (
                    <SimpleTerrain
                        terrainPalette={terrainPalette}
                        selectedTerrain={selectedTerrain}
                        onSelectedTerrainChange={onSelectedTerrainChange}
                        visibleTerrains={visibleTerrains}
                    />
                ) : (
                    <CompoundTerrain
                        terrainPalette={terrainPalette}
                        selectedTerrain={selectedTerrain}
                        onSelectedTerrainChange={onSelectedTerrainChange}
                        visibleTerrains={compoundVisibleTerrains}
                    />
                )}
            </Box>
        </Box>
    );
}
