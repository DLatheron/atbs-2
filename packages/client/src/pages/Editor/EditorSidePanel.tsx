import { Box, Button, Tab, Tabs, Typography } from "@mui/material";
import { Orientation } from "@atbs/maths";
import { TerrainPanel } from "../../components/TerrainPanel";
import { FurniturePanel } from "../../components/FurniturePanel";
import { WallsPanel } from "../../components/WallsPanel";
import { ItemsPanel } from "../../components/ItemsPanel";
import { MarkersPanel } from "../../components/MarkersPanel";
import { EditorMinimap } from "../../components/EditorMinimap";
import {
    EditorHistoryState,
    EditorMapWire,
    EditorMarkersState,
    FurniturePaletteWire,
    ItemPaletteWire,
    MarkerSideId,
    SelectedFurniture,
    SelectedItem,
    SelectedTerrain,
    SelectedWall,
    TerrainPaletteWire,
    WallPaletteWire
} from "@atbs/shared-data";
import { EditorPanelMode, EditorWorld } from "../../EditorWorld";

const EDITOR_TABS = ["Terrain", "Furniture", "Walls", "Items", "Markers"] as const;

export interface EditorSidePanelProps {
    map: EditorMapWire | null;
    world: EditorWorld;
    onSave: () => void;
    savedMessage: string | null;
    terrainPalette: TerrainPaletteWire | null;
    furniturePalette: FurniturePaletteWire | null;
    wallPalette: WallPaletteWire | null;
    itemPalette: ItemPaletteWire | null;
    markersState: EditorMarkersState | null;
    markersSavedMessage: string | null;
    selectedTerrain: SelectedTerrain;
    onSelectedTerrainChange: (selectedTerrain: SelectedTerrain) => void;
    selectedFurniture: SelectedFurniture;
    onSelectedFurnitureChange: (selectedFurniture: SelectedFurniture) => void;
    selectedWall: SelectedWall;
    onSelectedWallChange: (selectedWall: SelectedWall) => void;
    selectedItem: SelectedItem;
    onSelectedItemChange: (selectedItem: SelectedItem) => void;
    onSelectMarkerSide: (sideId: MarkerSideId) => void;
    onSelectMarkerZone: (zoneId: string | null) => void;
    onNewMarkerZone: () => void;
    onDoneMarkerZone: () => void;
    onDeleteMarkerZone: () => void;
    onUpdateMarkerZone: (updates: {
        name?: string;
        minUnits?: number | null;
        maxUnits?: number | null;
        orientation?: Orientation;
    }) => void;
    onSaveMarkers: () => void;
    editorPanel: EditorPanelMode;
    onEditorPanelChange: (editorPanel: EditorPanelMode) => void;
    history: EditorHistoryState;
    onUndo: () => void;
    onRedo: () => void;
}

export function EditorSidePanel({
    map,
    world,
    onSave,
    savedMessage,
    terrainPalette,
    furniturePalette,
    wallPalette,
    itemPalette,
    markersState,
    markersSavedMessage,
    selectedTerrain,
    onSelectedTerrainChange,
    selectedFurniture,
    onSelectedFurnitureChange,
    selectedWall,
    onSelectedWallChange,
    selectedItem,
    onSelectedItemChange,
    onSelectMarkerSide,
    onSelectMarkerZone,
    onNewMarkerZone,
    onDoneMarkerZone,
    onDeleteMarkerZone,
    onUpdateMarkerZone,
    onSaveMarkers,
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
            <EditorMinimap map={map} world={world} />

            <Tabs
                value={editorPanel}
                onChange={(_event, value: EditorPanelMode) => onEditorPanelChange(value)}
                sx={{
                    minHeight: 40,
                    borderBottom: 1,
                    borderColor: "divider",
                    "& .MuiTabs-indicator": {
                        display: "none"
                    },
                    "& .MuiTabs-list": {
                        flexWrap: "wrap"
                    },
                    "& .MuiTab-root": {
                        borderBottom: "2px solid transparent"
                    },
                    "& .MuiTab-root.Mui-selected": {
                        borderBottomColor: "primary.main"
                    }
                }}
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
                ) : editorPanel === "Items" && itemPalette ? (
                    <ItemsPanel
                        itemPalette={itemPalette}
                        selectedItem={selectedItem}
                        onSelectedItemChange={onSelectedItemChange}
                    />
                ) : editorPanel === "Markers" && markersState ? (
                    <MarkersPanel
                        markersState={markersState}
                        savedMessage={markersSavedMessage}
                        onSelectSide={onSelectMarkerSide}
                        onSelectZone={onSelectMarkerZone}
                        onNewZone={onNewMarkerZone}
                        onDoneZone={onDoneMarkerZone}
                        onDeleteZone={onDeleteMarkerZone}
                        onUpdateZone={onUpdateMarkerZone}
                        onSaveMarkers={onSaveMarkers}
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
