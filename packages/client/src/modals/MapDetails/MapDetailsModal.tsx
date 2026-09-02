import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    ToggleButton,
    Typography
} from "@mui/material";
import EastIcon from "@mui/icons-material/East";
import NorthIcon from "@mui/icons-material/North";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import NorthWestIcon from "@mui/icons-material/NorthWest";
import SouthIcon from "@mui/icons-material/South";
import SouthEastIcon from "@mui/icons-material/SouthEast";
import SouthWestIcon from "@mui/icons-material/SouthWest";
import WestIcon from "@mui/icons-material/West";
import { Orientation } from "@atbs/maths";
import { MAP_RESIZE_ANCHORS, MapResizeAnchor, TerrainPaletteWire } from "@atbs/shared-data";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { clampMapSize, isValidMapSetup, MapSizeFields, MapTerrainFields } from "../MapSetup";

const ANCHOR_ICONS: Partial<Record<MapResizeAnchor, ReactNode>> = {
    "north-west": <NorthWestIcon fontSize="small" />,
    north: <NorthIcon fontSize="small" />,
    "north-east": <NorthEastIcon fontSize="small" />,
    west: <WestIcon fontSize="small" />,
    east: <EastIcon fontSize="small" />,
    "south-west": <SouthWestIcon fontSize="small" />,
    south: <SouthIcon fontSize="small" />,
    "south-east": <SouthEastIcon fontSize="small" />
};

export interface MapDetailsModalProps {
    open: boolean;
    mapWidth: number;
    mapHeight: number;
    terrainPalette: TerrainPaletteWire | null;
    onClose: () => void;
    onConfirm: (details: {
        width: number;
        height: number;
        anchor: MapResizeAnchor;
        defaultTerrainId: string;
        defaultOrientation: Orientation;
        randomiseOrientation: boolean;
    }) => void;
}

export function MapDetailsModal({
    open,
    mapWidth,
    mapHeight,
    terrainPalette,
    onClose,
    onConfirm
}: MapDetailsModalProps) {
    const [width, setWidth] = useState(mapWidth);
    const [height, setHeight] = useState(mapHeight);
    const [anchor, setAnchor] = useState<MapResizeAnchor>("center");
    const [terrainIndex, setTerrainIndex] = useState(0);
    const [orientation, setOrientation] = useState(Orientation.NORTH);
    const [randomiseOrientation, setRandomiseOrientation] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        setWidth(mapWidth);
        setHeight(mapHeight);
        setAnchor("center");
        setTerrainIndex(0);
        setOrientation(Orientation.NORTH);
        setRandomiseOrientation(false);
    }, [open, mapWidth, mapHeight]);

    const selectedTerrain = terrainPalette?.terrains[terrainIndex];

    useEffect(() => {
        if (selectedTerrain && !selectedTerrain.allowRandomOrientation) {
            setRandomiseOrientation(false);
        }
    }, [selectedTerrain]);

    const canConfirm = useMemo(() => {
        return isValidMapSetup(width, height) && !!selectedTerrain;
    }, [width, height, selectedTerrain]);

    const handleConfirm = () => {
        if (!selectedTerrain || !canConfirm) {
            return;
        }

        onConfirm({
            width: clampMapSize(width),
            height: clampMapSize(height),
            anchor,
            defaultTerrainId: selectedTerrain.id,
            defaultOrientation: orientation,
            randomiseOrientation
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Map Details</DialogTitle>
            <DialogContent
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    overflow: "visible"
                }}
            >
                {terrainPalette ? (
                    <>
                        <MapSizeFields
                            width={width}
                            height={height}
                            onWidthChange={setWidth}
                            onHeightChange={setHeight}
                        />

                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Existing map position
                            </Typography>
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: 1,
                                    width: 180
                                }}
                            >
                                {MAP_RESIZE_ANCHORS.map((anchorId) => (
                                    <ToggleButton
                                        key={anchorId}
                                        value={anchorId}
                                        selected={anchor === anchorId}
                                        onClick={() => setAnchor(anchorId)}
                                        sx={{ minWidth: 0, px: 1 }}
                                    >
                                        {ANCHOR_ICONS[anchorId] ?? null}
                                    </ToggleButton>
                                ))}
                            </Box>
                        </Box>

                        <MapTerrainFields
                            terrainPalette={terrainPalette}
                            terrainIndex={terrainIndex}
                            onTerrainIndexChange={setTerrainIndex}
                            orientation={orientation}
                            onOrientationChange={setOrientation}
                            randomiseOrientation={randomiseOrientation}
                            onRandomiseOrientationChange={setRandomiseOrientation}
                            terrainSectionLabel="Default terrain for new tiles"
                        />
                    </>
                ) : null}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" disabled={!canConfirm} onClick={handleConfirm}>
                    OK
                </Button>
            </DialogActions>
        </Dialog>
    );
}
