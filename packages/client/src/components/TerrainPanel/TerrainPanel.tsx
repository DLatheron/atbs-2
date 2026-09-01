import { Box, FormControlLabel, IconButton, Switch, Tab, Tabs, Typography } from "@mui/material";
import { Orientation, rotateOrientation } from "@atbs/maths";
import { RenderImage, RenderList, SelectedTerrain, TerrainPaletteWire } from "@atbs/shared-data";
import { useEffect, useMemo } from "react";
import { ImageComponent } from "../Image";
import { getTerrainId } from "../../helpers/terrainHelpers";
import { useImageCache } from "../../hooks/useImageCache";

const TILE_SIZE = 72;

export interface TerrainPanelProps {
    terrainPalette: TerrainPaletteWire;
    selectedTerrain: SelectedTerrain;
    onSelectedTerrainChange: (selectedTerrain: SelectedTerrain) => void;
}

interface ImageSelectionGridProps {
    items: { id: string; uiImage: RenderList }[];
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
            {items.map((item, index) => {
                const selected = index === selectedIndex;
                return (
                    <Box
                        key={item.id}
                        onClick={() => onSelectionChanged({ index, orientation })}
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

function SimpleTerrain({
    terrainPalette,
    selectedTerrain,
    onSelectedTerrainChange
}: TerrainPanelProps) {
    const terrain = terrainPalette.terrains[selectedTerrain.index];

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <ImageSelectionGrid
                items={terrainPalette.terrains}
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
        </Box>
    );
}

function CompoundTerrain({
    terrainPalette,
    selectedTerrain,
    onSelectedTerrainChange
}: TerrainPanelProps) {
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

            <Typography variant="subtitle2">Background</Typography>
            <ImageSelectionGrid
                items={terrainPalette.terrains}
                selectedIndex={selectedTerrain.image1.index}
                orientation={selectedTerrain.image1.orientation}
                onSelectionChanged={({ index, orientation }) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        image1: { ...selectedTerrain.image1, index, orientation }
                    })
                }
            />
            <RandomiseToggle
                checked={
                    selectedTerrain.image1.randomiseOrientation &&
                    !!terrain1?.allowRandomOrientation
                }
                disabled={!terrain1?.allowRandomOrientation}
                onChange={(checked) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        image1: { ...selectedTerrain.image1, randomiseOrientation: checked }
                    })
                }
            />

            <Typography variant="subtitle2">Blend</Typography>
            <ImageSelectionGrid
                items={terrainPalette.blends}
                selectedIndex={selectedTerrain.blend.index}
                orientation={selectedTerrain.blend.orientation}
                blendMask
                onSelectionChanged={({ index, orientation }) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        blend: { index, orientation }
                    })
                }
            />

            <Typography variant="subtitle2">Foreground</Typography>
            <ImageSelectionGrid
                items={terrainPalette.terrains}
                selectedIndex={selectedTerrain.image2.index}
                orientation={selectedTerrain.image2.orientation}
                onSelectionChanged={({ index, orientation }) =>
                    onSelectedTerrainChange({
                        ...selectedTerrain,
                        image2: { ...selectedTerrain.image2, index, orientation }
                    })
                }
            />
            <RandomiseToggle
                checked={
                    selectedTerrain.image2.randomiseOrientation &&
                    !!terrain2?.allowRandomOrientation
                }
                disabled={!terrain2?.allowRandomOrientation}
                onChange={(checked) =>
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

    const previewImageId = useMemo(
        () => getTerrainId(terrainPalette, selectedTerrain, true),
        [terrainPalette, selectedTerrain]
    );

    useEffect(() => {
        if (previewImageId) {
            imageCache.requestImage(previewImageId);
        }
    }, [imageCache, previewImageId]);

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

            <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
                {tab === 0 ? (
                    <SimpleTerrain
                        terrainPalette={terrainPalette}
                        selectedTerrain={selectedTerrain}
                        onSelectedTerrainChange={onSelectedTerrainChange}
                    />
                ) : (
                    <CompoundTerrain
                        terrainPalette={terrainPalette}
                        selectedTerrain={selectedTerrain}
                        onSelectedTerrainChange={onSelectedTerrainChange}
                    />
                )}
            </Box>
        </Box>
    );
}
