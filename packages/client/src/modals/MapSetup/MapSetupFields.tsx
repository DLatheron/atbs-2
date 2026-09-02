import { Box, FormControlLabel, Switch, TextField, Typography } from "@mui/material";
import { Orientation, rotateOrientation } from "@atbs/maths";
import { RenderImage, TerrainPaletteEntry, TerrainPaletteWire } from "@atbs/shared-data";
import { ImageComponent } from "../../components/Image";

const TILE_SIZE = 56;
export const MIN_MAP_SIZE = 32;
export const MAX_MAP_SIZE = 256;

export interface MapSetupFieldsProps {
    width: number;
    height: number;
    onWidthChange: (width: number) => void;
    onHeightChange: (height: number) => void;
    terrainPalette: TerrainPaletteWire;
    terrainIndex: number;
    onTerrainIndexChange: (index: number) => void;
    orientation: Orientation;
    onOrientationChange: (orientation: Orientation) => void;
    randomiseOrientation: boolean;
    onRandomiseOrientationChange: (randomiseOrientation: boolean) => void;
    terrainSectionLabel?: string;
}

export function MapSizeFields({
    width,
    height,
    onWidthChange,
    onHeightChange
}: Pick<MapSetupFieldsProps, "width" | "height" | "onWidthChange" | "onHeightChange">) {
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, pt: 1 }}>
            <TextField
                label="Width"
                type="number"
                value={width}
                slotProps={{
                    htmlInput: { min: MIN_MAP_SIZE, max: MAX_MAP_SIZE },
                    inputLabel: { shrink: true }
                }}
                onChange={(event) => onWidthChange(Number(event.target.value))}
            />
            <TextField
                label="Height"
                type="number"
                value={height}
                slotProps={{
                    htmlInput: { min: MIN_MAP_SIZE, max: MAX_MAP_SIZE },
                    inputLabel: { shrink: true }
                }}
                onChange={(event) => onHeightChange(Number(event.target.value))}
            />
        </Box>
    );
}

export function MapTerrainFields({
    terrainPalette,
    terrainIndex,
    onTerrainIndexChange,
    orientation,
    onOrientationChange,
    randomiseOrientation,
    onRandomiseOrientationChange,
    terrainSectionLabel = "Default terrain"
}: Omit<MapSetupFieldsProps, "width" | "height" | "onWidthChange" | "onHeightChange">) {
    const selectedTerrain = terrainPalette.terrains[terrainIndex];
    const allowsRandomOrientation = selectedTerrain?.allowRandomOrientation ?? false;

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {terrainSectionLabel}
            </Typography>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 1,
                    maxHeight: 220,
                    overflowY: "auto"
                }}
            >
                {terrainPalette.terrains.map((terrain: TerrainPaletteEntry, index: number) => {
                    const selected = index === terrainIndex;
                    return (
                        <Box
                            key={terrain.id}
                            onClick={() => {
                                onTerrainIndexChange(index);
                                onOrientationChange(Orientation.NORTH);
                            }}
                            sx={{
                                border: selected ? "2px solid #1e90ff" : "1px solid #ccc",
                                cursor: "pointer",
                                p: 0.5
                            }}
                        >
                            <ImageComponent
                                images={terrain.uiImage.map((image: RenderImage) => ({
                                    ...image,
                                    orientation: rotateOrientation(
                                        image.orientation ?? Orientation.NORTH,
                                        orientation
                                    )
                                }))}
                                width={TILE_SIZE}
                                height={TILE_SIZE}
                            />
                        </Box>
                    );
                })}
            </Box>
            <FormControlLabel
                sx={{ ml: 0, mt: 1 }}
                control={
                    <Switch
                        size="small"
                        checked={randomiseOrientation}
                        disabled={!allowsRandomOrientation}
                        onChange={(_event, value) => onRandomiseOrientationChange(value)}
                    />
                }
                label="Randomise Orientation"
            />
        </Box>
    );
}

export function MapSetupFields(props: MapSetupFieldsProps) {
    return (
        <>
            <MapSizeFields
                width={props.width}
                height={props.height}
                onWidthChange={props.onWidthChange}
                onHeightChange={props.onHeightChange}
            />
            <MapTerrainFields {...props} />
        </>
    );
}

export function isValidMapSetup(width: number, height: number): boolean {
    return (
        width >= MIN_MAP_SIZE &&
        width <= MAX_MAP_SIZE &&
        height >= MIN_MAP_SIZE &&
        height <= MAX_MAP_SIZE
    );
}

export function clampMapSize(value: number): number {
    return Math.min(MAX_MAP_SIZE, Math.max(MIN_MAP_SIZE, value));
}
