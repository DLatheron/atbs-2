import { Box, Button, Tab, Tabs, Typography } from "@mui/material";
import { useState } from "react";
import { TerrainPanel } from "../../components/TerrainPanel";
import { EditorHistoryState, SelectedTerrain, TerrainPaletteWire } from "@atbs/shared-data";

const EDITOR_TABS = ["Terrain", "Furniture", "Walls", "Items", "Markers"] as const;
type EditorTab = (typeof EDITOR_TABS)[number];

export interface EditorSidePanelProps {
    onSave: () => void;
    savedMessage: string | null;
    terrainPalette: TerrainPaletteWire | null;
    selectedTerrain: SelectedTerrain;
    onSelectedTerrainChange: (selectedTerrain: SelectedTerrain) => void;
    history: EditorHistoryState;
    onUndo: () => void;
    onRedo: () => void;
}

export function EditorSidePanel({
    onSave,
    savedMessage,
    terrainPalette,
    selectedTerrain,
    onSelectedTerrainChange,
    history,
    onUndo,
    onRedo
}: EditorSidePanelProps) {
    const [tab, setTab] = useState<EditorTab>("Terrain");

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                p: 1,
                boxSizing: "border-box"
            }}
        >
            <Tabs
                value={tab}
                onChange={(_event, value: EditorTab) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 40, borderBottom: 1, borderColor: "divider" }}
            >
                {EDITOR_TABS.map((label) => (
                    <Tab key={label} label={label} value={label} sx={{ minHeight: 40, py: 0 }} />
                ))}
            </Tabs>

            <Box sx={{ flex: 1, minHeight: 0, py: 1, overflow: "hidden" }}>
                {tab === "Terrain" && terrainPalette ? (
                    <TerrainPanel
                        terrainPalette={terrainPalette}
                        selectedTerrain={selectedTerrain}
                        onSelectedTerrainChange={onSelectedTerrainChange}
                    />
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        {tab}: Coming soon
                    </Typography>
                )}
            </Box>

            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <Button variant="outlined" fullWidth disabled={!history.canUndo} onClick={onUndo}>
                    Undo
                </Button>
                <Button variant="outlined" fullWidth disabled={!history.canRedo} onClick={onRedo}>
                    Redo
                </Button>
            </Box>

            {savedMessage ? (
                <Typography variant="caption" color="success.main" sx={{ mb: 1 }}>
                    {savedMessage}
                </Typography>
            ) : null}

            <Button variant="contained" fullWidth onClick={onSave}>
                Save
            </Button>
        </Box>
    );
}
