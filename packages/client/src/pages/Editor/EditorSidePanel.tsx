import { Box, Button, Tab, Tabs, Typography } from "@mui/material";
import { TerrainPanel } from "../../components/TerrainPanel";
import { FurniturePanel } from "../../components/FurniturePanel";
import { WallsPanel } from "../../components/WallsPanel";
import {
    EditorHistoryState,
    FurniturePaletteWire,
    SelectedFurniture,
    SelectedTerrain,
    SelectedWall,
    TerrainPaletteWire,
    WallPaletteWire
} from "@atbs/shared-data";
import { EditorPanelMode } from "../../EditorWorld";

const EDITOR_TABS = ["Terrain", "Furniture", "Walls", "Items", "Markers"] as const;

export interface EditorSidePanelProps {
    onSave: () => void;
    savedMessage: string | null;
    terrainPalette: TerrainPaletteWire | null;
    furniturePalette: FurniturePaletteWire | null;
    wallPalette: WallPaletteWire | null;
    selectedTerrain: SelectedTerrain;
    onSelectedTerrainChange: (selectedTerrain: SelectedTerrain) => void;
    selectedFurniture: SelectedFurniture;
    onSelectedFurnitureChange: (selectedFurniture: SelectedFurniture) => void;
    selectedWall: SelectedWall;
    onSelectedWallChange: (selectedWall: SelectedWall) => void;
    editorPanel: EditorPanelMode;
    onEditorPanelChange: (editorPanel: EditorPanelMode) => void;
    history: EditorHistoryState;
    onUndo: () => void;
    onRedo: () => void;
}

export function EditorSidePanel({
    onSave,
    savedMessage,
    terrainPalette,
    furniturePalette,
    wallPalette,
    selectedTerrain,
    onSelectedTerrainChange,
    selectedFurniture,
    onSelectedFurnitureChange,
    selectedWall,
    onSelectedWallChange,
    editorPanel,
    onEditorPanelChange,
    history,
    onUndo,
    onRedo
}: EditorSidePanelProps) {
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
                value={editorPanel}
                onChange={(_event, value: EditorPanelMode) => onEditorPanelChange(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 40, borderBottom: 1, borderColor: "divider" }}
            >
                {EDITOR_TABS.map((label) => (
                    <Tab key={label} label={label} value={label} sx={{ minHeight: 40, py: 0 }} />
                ))}
            </Tabs>

            <Box sx={{ flex: 1, minHeight: 0, py: 1, overflow: "hidden" }}>
                {editorPanel === "Terrain" && terrainPalette ? (
                    <TerrainPanel
                        terrainPalette={terrainPalette}
                        selectedTerrain={selectedTerrain}
                        onSelectedTerrainChange={onSelectedTerrainChange}
                    />
                ) : editorPanel === "Furniture" && furniturePalette ? (
                    <FurniturePanel
                        furniturePalette={furniturePalette}
                        selectedFurniture={selectedFurniture}
                        onSelectedFurnitureChange={onSelectedFurnitureChange}
                    />
                ) : editorPanel === "Walls" && wallPalette ? (
                    <WallsPanel
                        wallPalette={wallPalette}
                        selectedWall={selectedWall}
                        onSelectedWallChange={onSelectedWallChange}
                    />
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        {editorPanel}: Coming soon
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
