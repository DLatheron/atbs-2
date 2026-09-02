import { Box, FormControlLabel, IconButton, Switch, Typography } from "@mui/material";
import { Orientation, rotateOrientation } from "@atbs/maths";
import {
    FurniturePaletteEntry,
    FurniturePaletteWire,
    RenderImage,
    SelectedFurniture
} from "@atbs/shared-data";
import { useEffect } from "react";
import { ImageComponent } from "../Image";
import {
    getRotatedFurnitureDimensions,
    getRotatedFurniturePreviewImages
} from "../../helpers/furnitureHelpers";

const GRID_TILE_SIZE = 28;
const CELL_SIZE = 72;

export interface FurniturePanelProps {
    furniturePalette: FurniturePaletteWire;
    selectedFurniture: SelectedFurniture;
    onSelectedFurnitureChange: (selectedFurniture: SelectedFurniture) => void;
}

function furnitureDisplayName(entry: FurniturePaletteEntry): string {
    return entry.furniture[0]?.[0]?.name ?? entry.id;
}

function FurniturePaletteCell({
    furniturePalette,
    index,
    orientation,
    selected,
    onSelect
}: {
    furniturePalette: FurniturePaletteWire;
    index: number;
    orientation: Orientation;
    selected: boolean;
    onSelect: () => void;
}) {
    const entry = furniturePalette.furniture[index];
    if (!entry) {
        return null;
    }

    const selection: SelectedFurniture = {
        index,
        orientation,
        randomiseOrientation: false
    };
    const dimensions = getRotatedFurnitureDimensions(furniturePalette, selection);
    const previewImages = getRotatedFurniturePreviewImages(furniturePalette, selection);
    const name = furnitureDisplayName(entry);

    return (
        <Box
            onClick={onSelect}
            title={name}
            sx={{
                border: selected ? "2px solid #1e90ff" : "1px solid #ccc",
                cursor: "pointer",
                p: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: CELL_SIZE,
                boxSizing: "border-box"
            }}
        >
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${dimensions.x}, ${GRID_TILE_SIZE}px)`,
                    gridTemplateRows: `repeat(${dimensions.y}, ${GRID_TILE_SIZE}px)`,
                    gap: 0
                }}
            >
                {previewImages.map(({ x, y, uiImage }) => (
                    <ImageComponent
                        key={`${entry.id}-${x}-${y}-${orientation}`}
                        images={uiImage.map((image: RenderImage) => ({
                            ...image,
                            orientation: rotateOrientation(
                                image.orientation ?? Orientation.NORTH,
                                -orientation
                            )
                        }))}
                        width={GRID_TILE_SIZE}
                        height={GRID_TILE_SIZE}
                    />
                ))}
            </Box>
        </Box>
    );
}

export function FurniturePanel({
    furniturePalette,
    selectedFurniture,
    onSelectedFurnitureChange
}: FurniturePanelProps) {
    const entry = furniturePalette.furniture[selectedFurniture.index];
    const previewName = entry ? furnitureDisplayName(entry) : "Empty";

    useEffect(() => {
        if (entry && !entry.allowRandomOrientation && selectedFurniture.randomiseOrientation) {
            onSelectedFurnitureChange({
                ...selectedFurniture,
                randomiseOrientation: false
            });
        }
    }, [entry, selectedFurniture, onSelectedFurnitureChange]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            <Typography variant="subtitle2" sx={{ textAlign: "center" }}>
                {previewName}
            </Typography>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 1
                    }}
                >
                    {furniturePalette.furniture.map(
                        (furnitureEntry: FurniturePaletteEntry, index: number) => (
                            <FurniturePaletteCell
                                key={furnitureEntry.id}
                                furniturePalette={furniturePalette}
                                index={index}
                                orientation={selectedFurniture.orientation}
                                selected={index === selectedFurniture.index}
                                onSelect={() =>
                                    onSelectedFurnitureChange({
                                        ...selectedFurniture,
                                        index
                                    })
                                }
                            />
                        )
                    )}
                </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <IconButton
                    size="small"
                    onClick={() =>
                        onSelectedFurnitureChange({
                            ...selectedFurniture,
                            orientation: rotateOrientation(selectedFurniture.orientation, -2)
                        })
                    }
                >
                    ↺
                </IconButton>
                <IconButton
                    size="small"
                    onClick={() =>
                        onSelectedFurnitureChange({
                            ...selectedFurniture,
                            orientation: rotateOrientation(selectedFurniture.orientation, 2)
                        })
                    }
                >
                    ↻
                </IconButton>
            </Box>

            <FormControlLabel
                sx={{ ml: 0, mr: 0, boxSizing: "border-box" }}
                control={
                    <Switch
                        size="small"
                        checked={
                            selectedFurniture.randomiseOrientation &&
                            !!entry?.allowRandomOrientation
                        }
                        disabled={!entry?.allowRandomOrientation}
                        onChange={(_event, checked) =>
                            onSelectedFurnitureChange({
                                ...selectedFurniture,
                                randomiseOrientation: checked
                            })
                        }
                    />
                }
                label="Randomise Orientation"
            />

            <Typography variant="caption" color="text.secondary">
                Click a tile to place the selected furniture. Alt+click to remove.
            </Typography>
        </Box>
    );
}
