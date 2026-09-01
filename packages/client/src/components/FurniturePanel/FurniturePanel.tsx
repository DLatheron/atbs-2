import { Box, FormControlLabel, IconButton, Switch, Typography } from "@mui/material";
import { Orientation, rotateOrientation } from "@atbs/maths";
import { FurniturePaletteWire, RenderImage, SelectedFurniture } from "@atbs/shared-data";
import { ImageComponent } from "../Image";
import {
    getRotatedFurnitureDimensions,
    getRotatedFurniturePreviewImages
} from "../../helpers/furnitureHelpers";

const TILE_SIZE = 72;

export interface FurniturePanelProps {
    furniturePalette: FurniturePaletteWire;
    selectedFurniture: SelectedFurniture;
    onSelectedFurnitureChange: (selectedFurniture: SelectedFurniture) => void;
}

export function FurniturePanel({
    furniturePalette,
    selectedFurniture,
    onSelectedFurnitureChange
}: FurniturePanelProps) {
    const entry = furniturePalette.furniture[selectedFurniture.index];
    const dimensions = getRotatedFurnitureDimensions(furniturePalette, selectedFurniture);
    const previewImages = getRotatedFurniturePreviewImages(furniturePalette, selectedFurniture);
    const previewName = entry?.furniture[0]?.[0]?.name ?? "Empty";

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="subtitle2" sx={{ textAlign: "center" }}>
                {previewName}
            </Typography>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${dimensions.x}, 1fr)`,
                    gridTemplateRows: `repeat(${dimensions.y}, 1fr)`,
                    gap: 0.5,
                    mx: "auto"
                }}
            >
                {previewImages.map(({ x, y, uiImage }) => (
                    <ImageComponent
                        key={`furniture-preview-${x}-${y}-${selectedFurniture.orientation}`}
                        images={uiImage.map((image: RenderImage) => ({
                            ...image,
                            orientation: rotateOrientation(
                                image.orientation ?? Orientation.NORTH,
                                -selectedFurniture.orientation
                            )
                        }))}
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                    />
                ))}
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <IconButton
                    size="small"
                    onClick={() =>
                        onSelectedFurnitureChange({
                            ...selectedFurniture,
                            index:
                                (selectedFurniture.index - 1 + furniturePalette.furniture.length) %
                                furniturePalette.furniture.length
                        })
                    }
                >
                    ◀
                </IconButton>
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
                <IconButton
                    size="small"
                    onClick={() =>
                        onSelectedFurnitureChange({
                            ...selectedFurniture,
                            index: (selectedFurniture.index + 1) % furniturePalette.furniture.length
                        })
                    }
                >
                    ▶
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
        </Box>
    );
}
