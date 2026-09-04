import { Box, FormControlLabel, IconButton, Switch, Typography } from "@mui/material";
import { Orientation, rotateOrientation } from "@atbs/maths";
import { RenderImage, SelectedWall, WallPaletteWire } from "@atbs/shared-data";
import { ImageComponent } from "../Image";

const TILE_SIZE = 72;

export interface WallsPanelProps {
    wallPalette: WallPaletteWire;
    selectedWall: SelectedWall;
    onSelectedWallChange: (selectedWall: SelectedWall) => void;
}

export function WallsPanel({ wallPalette, selectedWall, onSelectedWallChange }: WallsPanelProps) {
    const wall = wallPalette.walls[selectedWall.index];
    const previewName = wall?.name ?? "Empty";

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="subtitle2" sx={{ textAlign: "center" }}>
                {previewName}
            </Typography>

            <Box sx={{ mx: "auto" }}>
                {wall ? (
                    <ImageComponent
                        key={`wall-preview-${selectedWall.index}-${selectedWall.orientation}`}
                        images={wall.uiImage.map((image: RenderImage) => ({
                            ...image,
                            orientation: rotateOrientation(
                                image.orientation ?? Orientation.NORTH,
                                -selectedWall.orientation
                            )
                        }))}
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                    />
                ) : null}
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <IconButton
                    size="small"
                    disabled={selectedWall.autoFit}
                    onClick={() =>
                        onSelectedWallChange({
                            ...selectedWall,
                            index:
                                (selectedWall.index - 1 + wallPalette.walls.length) %
                                wallPalette.walls.length
                        })
                    }
                >
                    ◀
                </IconButton>
                <IconButton
                    size="small"
                    disabled={selectedWall.autoFit}
                    onClick={() =>
                        onSelectedWallChange({
                            ...selectedWall,
                            orientation: rotateOrientation(selectedWall.orientation, -2)
                        })
                    }
                >
                    ↺
                </IconButton>
                <IconButton
                    size="small"
                    disabled={selectedWall.autoFit}
                    onClick={() =>
                        onSelectedWallChange({
                            ...selectedWall,
                            orientation: rotateOrientation(selectedWall.orientation, 2)
                        })
                    }
                >
                    ↻
                </IconButton>
                <IconButton
                    size="small"
                    disabled={selectedWall.autoFit}
                    onClick={() =>
                        onSelectedWallChange({
                            ...selectedWall,
                            index: (selectedWall.index + 1) % wallPalette.walls.length
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
                        checked={selectedWall.autoFit}
                        onChange={(_event, checked) =>
                            onSelectedWallChange({
                                ...selectedWall,
                                autoFit: checked
                            })
                        }
                    />
                }
                label="Auto-Select"
            />

            <Typography variant="caption" color="text.secondary">
                Hotkeys (r t y f g h v b n) override the next piece. Arrow keys bias auto-select
                direction.
            </Typography>
        </Box>
    );
}
