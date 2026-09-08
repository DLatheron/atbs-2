import { Box, FormControlLabel, Switch, Typography } from "@mui/material";
import { Orientation, rotateOrientation } from "@atbs/maths";
import { RenderImage, SelectedWall, WallPaletteEntry, WallPaletteWire } from "@atbs/shared-data";
import { ImageComponent } from "../Image";
import {
    clearWallPieceSelection,
    getSelectedWallFamily,
    getSelectedWallGrid,
    getFamilyExtraWalls,
    getWallFamilies,
    isWallPiecePinned,
    selectWallFamily,
    selectWallGridOption,
    wallGridPreviewOrientation
} from "../../helpers/wallHelpers";

const TYPE_TILE_SIZE = 40;
const GRID_TILE_SIZE = 56;

export interface WallsPanelProps {
    wallPalette: WallPaletteWire;
    selectedWall: SelectedWall;
    onSelectedWallChange: (selectedWall: SelectedWall) => void;
}

function WallPreview({
    wall,
    orientation,
    size
}: {
    wall: WallPaletteEntry;
    orientation: Orientation;
    size: number;
}) {
    return (
        <ImageComponent
            images={wall.uiImage.map((image: RenderImage) => ({
                ...image,
                orientation: rotateOrientation(image.orientation ?? Orientation.NORTH, -orientation)
            }))}
            width={size}
            height={size}
        />
    );
}

export function WallsPanel({ wallPalette, selectedWall, onSelectedWallChange }: WallsPanelProps) {
    const families = getWallFamilies(wallPalette);
    const selectedFamily = getSelectedWallFamily(wallPalette, selectedWall);
    const grid = getSelectedWallGrid(wallPalette, selectedWall);
    const extraWalls = getFamilyExtraWalls(wallPalette, selectedWall);
    const selectedEntry = wallPalette.walls[selectedWall.index];
    const piecePinned = isWallPiecePinned(selectedWall);
    const previewName = piecePinned
        ? (selectedEntry?.name ?? selectedFamily?.name ?? "Empty")
        : (selectedFamily?.name ?? "Empty");

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                height: "100%",
                overflowY: "auto"
            }}
        >
            <Typography variant="subtitle2" sx={{ textAlign: "center" }}>
                {previewName}
                {!piecePinned && selectedWall.autoFit ? " (auto)" : ""}
            </Typography>

            <Typography variant="caption" color="text.secondary">
                Wall type
            </Typography>
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 0.5,
                    justifyContent: "center"
                }}
            >
                {families.map((family) => {
                    const selected = family.id === selectedFamily?.id;

                    return (
                        <Box
                            key={family.id}
                            onClick={() =>
                                onSelectedWallChange(
                                    selectWallFamily(wallPalette, selectedWall, family.id)
                                )
                            }
                            title={family.name}
                            sx={{
                                border: selected ? "2px solid #1e90ff" : "1px solid #ccc",
                                cursor: "pointer",
                                p: 0.25,
                                boxSizing: "border-box",
                                bgcolor: selected ? "action.selected" : "transparent"
                            }}
                        >
                            <WallPreview
                                wall={family.representative}
                                orientation={family.previewOrientation}
                                size={TYPE_TILE_SIZE}
                            />
                        </Box>
                    );
                })}
            </Box>

            <FormControlLabel
                sx={{ ml: 0, mr: 0, boxSizing: "border-box" }}
                control={
                    <Switch
                        size="small"
                        checked={selectedWall.autoFit}
                        onChange={(_event, checked) =>
                            onSelectedWallChange(
                                checked
                                    ? clearWallPieceSelection(wallPalette, {
                                          ...selectedWall,
                                          autoFit: true
                                      })
                                    : {
                                          ...selectedWall,
                                          autoFit: false,
                                          pinned: true
                                      }
                            )
                        }
                    />
                }
                label="Auto-Select"
            />

            <Typography variant="caption" color="text.secondary">
                Wall piece
                {piecePinned ? " — click selected again to clear" : ""}
            </Typography>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 0.5,
                    width: "fit-content",
                    mx: "auto"
                }}
            >
                {grid.map((cell) => {
                    const selectedOption = piecePinned
                        ? cell.options.find(
                              (entry) =>
                                  entry.id === selectedEntry?.id &&
                                  entry.orientation === selectedWall.orientation
                          )
                        : undefined;
                    const option = selectedOption ?? cell.options[0];
                    const wall = option
                        ? wallPalette.walls.find((entry) => entry.id === option.id)
                        : undefined;
                    const selected = Boolean(selectedOption);
                    const disabled = !option || !wall;

                    return (
                        <Box
                            key={cell.key}
                            onClick={() => {
                                if (!option) {
                                    return;
                                }

                                const currentIndex = cell.options.findIndex(
                                    (entry) =>
                                        entry.id === selectedEntry?.id &&
                                        entry.orientation === selectedWall.orientation
                                );

                                if (piecePinned && currentIndex >= 0) {
                                    if (
                                        cell.options.length === 1 ||
                                        currentIndex === cell.options.length - 1
                                    ) {
                                        onSelectedWallChange(
                                            clearWallPieceSelection(wallPalette, selectedWall)
                                        );
                                        return;
                                    }

                                    onSelectedWallChange(
                                        selectWallGridOption(
                                            wallPalette,
                                            selectedWall,
                                            cell.options[(currentIndex + 1) % cell.options.length]
                                        )
                                    );
                                    return;
                                }

                                onSelectedWallChange(
                                    selectWallGridOption(wallPalette, selectedWall, option)
                                );
                            }}
                            title={
                                disabled
                                    ? undefined
                                    : selected
                                      ? `${wall.name} (${cell.key}) — click to ${cell.options.length > 1 ? "cycle / clear" : "clear"}`
                                      : `${wall.name} (${cell.key})${cell.options.length > 1 ? " — click to select" : ""}`
                            }
                            sx={{
                                border: selected ? "2px solid #1e90ff" : "1px solid #ccc",
                                cursor: disabled ? "default" : "pointer",
                                width: GRID_TILE_SIZE + 8,
                                height: GRID_TILE_SIZE + 8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxSizing: "border-box",
                                opacity: disabled ? 0.35 : 1,
                                bgcolor: selected ? "action.selected" : "transparent"
                            }}
                        >
                            {wall && option ? (
                                <WallPreview
                                    wall={wall}
                                    orientation={wallGridPreviewOrientation(
                                        selectedFamily?.id ?? "",
                                        cell.key,
                                        option.orientation
                                    )}
                                    size={GRID_TILE_SIZE}
                                />
                            ) : null}
                        </Box>
                    );
                })}
            </Box>

            {extraWalls.length > 0 ? (
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        justifyContent: "center"
                    }}
                >
                    {extraWalls.map((wall) => {
                        const selected = piecePinned && wall.id === selectedEntry?.id;

                        return (
                            <Box
                                key={wall.id}
                                onClick={() => {
                                    if (selected) {
                                        onSelectedWallChange(
                                            clearWallPieceSelection(wallPalette, selectedWall)
                                        );
                                        return;
                                    }

                                    onSelectedWallChange(
                                        selectWallGridOption(wallPalette, selectedWall, {
                                            id: wall.id,
                                            orientation: selectedWall.orientation
                                        })
                                    );
                                }}
                                title={selected ? `${wall.name} — click to clear` : wall.name}
                                sx={{
                                    border: selected ? "2px solid #1e90ff" : "1px solid #ccc",
                                    cursor: "pointer",
                                    p: 0.25,
                                    boxSizing: "border-box",
                                    bgcolor: selected ? "action.selected" : "transparent"
                                }}
                            >
                                <WallPreview
                                    wall={wall}
                                    orientation={selectedWall.orientation}
                                    size={TYPE_TILE_SIZE}
                                />
                            </Box>
                        );
                    })}
                </Box>
            ) : null}

            <Typography variant="caption" color="text.secondary">
                {selectedWall.autoFit
                    ? piecePinned
                        ? "Piece pinned as the isolated-tile seed; neighbours still auto-fit. Click it again to clear."
                        : "No piece pinned — drawing auto-picks the best piece of this wall type."
                    : "Auto-select is off — the selected piece is placed as-is."}{" "}
                Hotkeys r t y / f g h / v b n. Arrow keys bias auto-select direction.
            </Typography>
        </Box>
    );
}
