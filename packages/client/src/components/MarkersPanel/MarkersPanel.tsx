import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import { Orientation } from "@atbs/maths";
import { EditorMarkersState, MARKER_SIDE_IDS, MarkerSideId } from "@atbs/shared-data";
import { ORIENTATION_OPTIONS } from "../../helpers/markerHelpers";

export interface MarkersPanelProps {
    markersState: EditorMarkersState;
    savedMessage: string | null;
    onSelectSide: (sideId: MarkerSideId) => void;
    onSelectZone: (zoneId: string | null) => void;
    onNewZone: () => void;
    onDoneZone: () => void;
    onDeleteZone: () => void;
    onUpdateZone: (updates: {
        name?: string;
        minUnits?: number | null;
        maxUnits?: number | null;
        orientation?: Orientation;
    }) => void;
    onSaveMarkers: () => void;
}

function parseOptionalCount(value: string): number | null | undefined {
    if (value.trim() === "") {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
}

export function MarkersPanel({
    markersState,
    savedMessage,
    onSelectSide,
    onSelectZone,
    onNewZone,
    onDoneZone,
    onDeleteZone,
    onUpdateZone,
    onSaveMarkers
}: MarkersPanelProps) {
    const selectedSide = markersState.sides[markersState.selectedSideId];
    const selectedZone = selectedSide.zones.find((zone) => zone.id === markersState.selectedZoneId);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={markersState.selectedSideId}
                onChange={(_event, value: MarkerSideId | null) => {
                    if (value) {
                        onSelectSide(value);
                    }
                }}
            >
                {MARKER_SIDE_IDS.map((sideId) => (
                    <ToggleButton key={sideId} value={sideId}>
                        {sideId}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            <Box sx={{ display: "flex", gap: 1 }}>
                <Button variant="outlined" fullWidth onClick={onNewZone}>
                    New Zone
                </Button>
                <Button
                    variant="outlined"
                    fullWidth
                    disabled={!selectedZone?.isDrawing}
                    onClick={onDoneZone}
                >
                    Done
                </Button>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {selectedSide.zones.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No zones for {markersState.selectedSideId}. Create one to start marking tiles.
                    </Typography>
                ) : (
                    selectedSide.zones.map((zone) => {
                        const selected = zone.id === markersState.selectedZoneId;
                        return (
                            <Box
                                key={zone.id}
                                onClick={() => onSelectZone(zone.id)}
                                sx={{
                                    border: selected ? "2px solid #1e90ff" : "1px solid #ccc",
                                    borderRadius: 1,
                                    p: 1,
                                    mb: 1,
                                    cursor: "pointer"
                                }}
                            >
                                <Typography variant="subtitle2">
                                    {zone.name}
                                    {zone.isDrawing ? " (drawing)" : ""}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {zone.tiles.length} tile{zone.tiles.length === 1 ? "" : "s"}
                                </Typography>
                            </Box>
                        );
                    })
                )}
            </Box>

            {selectedZone ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <TextField
                        label="Zone name"
                        size="small"
                        value={selectedZone.name}
                        onChange={(event) => {
                            if (event.target.value.trim().length > 0) {
                                onUpdateZone({ name: event.target.value });
                            }
                        }}
                    />
                    <TextField
                        label="Min units"
                        size="small"
                        placeholder="undefined"
                        value={selectedZone.minUnits ?? ""}
                        onChange={(event) =>
                            onUpdateZone({ minUnits: parseOptionalCount(event.target.value) })
                        }
                    />
                    <TextField
                        label="Max units"
                        size="small"
                        placeholder="undefined"
                        value={selectedZone.maxUnits ?? ""}
                        onChange={(event) =>
                            onUpdateZone({ maxUnits: parseOptionalCount(event.target.value) })
                        }
                    />
                    <FormControl size="small">
                        <InputLabel id="zone-orientation-label">Orientation</InputLabel>
                        <Select
                            labelId="zone-orientation-label"
                            label="Orientation"
                            value={selectedZone.orientation}
                            onChange={(event) =>
                                onUpdateZone({
                                    orientation: Number(event.target.value) as Orientation
                                })
                            }
                        >
                            {ORIENTATION_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button color="error" variant="outlined" onClick={onDeleteZone}>
                        Delete Zone
                    </Button>
                </Box>
            ) : null}

            {savedMessage ? (
                <Typography variant="caption" color="success.main">
                    {savedMessage}
                </Typography>
            ) : null}

            <Button variant="contained" onClick={onSaveMarkers}>
                Save Markers
            </Button>

            <Typography variant="caption" color="text.secondary">
                Left-click drag to add tiles to the selected zone. Alt+click removes tiles. Click a
                marked tile to select its zone.
            </Typography>
        </Box>
    );
}
