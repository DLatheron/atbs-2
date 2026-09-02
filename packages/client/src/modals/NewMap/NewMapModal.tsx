import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { Orientation } from "@atbs/maths";
import { TerrainPaletteWire } from "@atbs/shared-data";
import { useEffect, useMemo, useState } from "react";
import { clampMapSize, isValidMapSetup, MapSetupFields } from "../MapSetup";

export interface NewMapModalProps {
    open: boolean;
    hasUnsavedChanges: boolean;
    terrainPalette: TerrainPaletteWire | null;
    onClose: () => void;
    onConfirm: (details: {
        width: number;
        height: number;
        defaultTerrainId: string;
        defaultOrientation: Orientation;
        randomiseOrientation: boolean;
    }) => void;
}

export function NewMapModal({
    open,
    hasUnsavedChanges,
    terrainPalette,
    onClose,
    onConfirm
}: NewMapModalProps) {
    const [width, setWidth] = useState(100);
    const [height, setHeight] = useState(100);
    const [terrainIndex, setTerrainIndex] = useState(0);
    const [orientation, setOrientation] = useState(Orientation.NORTH);
    const [randomiseOrientation, setRandomiseOrientation] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        setWidth(100);
        setHeight(100);
        setTerrainIndex(0);
        setOrientation(Orientation.NORTH);
        setRandomiseOrientation(false);
    }, [open]);

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
            defaultTerrainId: selectedTerrain.id,
            defaultOrientation: orientation,
            randomiseOrientation
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>New Map</DialogTitle>
            <DialogContent
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    overflow: "visible"
                }}
            >
                {hasUnsavedChanges ? (
                    <Alert severity="warning">
                        You have unsaved changes. Creating a new map will discard them and will not
                        save the current map.
                    </Alert>
                ) : null}

                {terrainPalette ? (
                    <MapSetupFields
                        width={width}
                        height={height}
                        onWidthChange={setWidth}
                        onHeightChange={setHeight}
                        terrainPalette={terrainPalette}
                        terrainIndex={terrainIndex}
                        onTerrainIndexChange={setTerrainIndex}
                        orientation={orientation}
                        onOrientationChange={setOrientation}
                        randomiseOrientation={randomiseOrientation}
                        onRandomiseOrientationChange={setRandomiseOrientation}
                    />
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
