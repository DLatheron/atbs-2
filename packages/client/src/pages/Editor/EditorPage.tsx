import { Box, Button, Container, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useCallback } from "react";
import { EditorId, RenderMode } from "@atbs/shared-data";
import { CanvasLoopProps, MapComponent, SidePanel, TitleBarComponent } from "../../components";
import { useEditorWorld } from "../../hooks";
import { EditorWorld } from "../../EditorWorld";
import { useEditorPage } from "./useEditorPage";
import { EditorSidePanel } from "./EditorSidePanel";
import { MapDetailsModal, NewMapModal, LoadMapModal } from "../../modals";

export interface EditorPageProps {
    visible: boolean;
    editorId?: EditorId;
}

export function EditorPage({ visible, editorId }: EditorPageProps) {
    const statusBarHeight = 60;
    const statusBarHeightAndPadding = statusBarHeight + 2 * 8;

    const {
        map,
        savedMessage,
        onSave,
        mapDetailsOpen,
        onOpenMapDetails,
        onCloseMapDetails,
        onConfirmMapDetails,
        newMapOpen,
        onOpenNewMap,
        onCloseNewMap,
        onConfirmNewMap,
        loadMapOpen,
        loadMapEntries,
        loadMapLoading,
        onOpenLoadMap,
        onCloseLoadMap,
        onRequestLoadMapList,
        onConfirmLoadMap,
        terrainPalette,
        furniturePalette,
        wallPalette,
        itemPalette,
        markersState,
        markersSavedMessage,
        selectedTerrain,
        setSelectedTerrain,
        selectedFurniture,
        setSelectedFurniture,
        selectedWall,
        setSelectedWall,
        selectedItem,
        setSelectedItem,
        editorPanel,
        setEditorPanel,
        renderMode,
        setRenderMode,
        history,
        onUndo,
        onRedo,
        onSelectMarkerSide,
        onSelectMarkerZone,
        onNewMarkerZone,
        onDoneMarkerZone,
        onDeleteMarkerZone,
        onUpdateMarkerZone,
        onSaveMarkers
    } = useEditorPage();
    const { world } = useEditorWorld();

    const renderMap = useCallback(
        (props: CanvasLoopProps) => world.renderDeploymentPhase(props),
        [world]
    );

    const onMouseEnter = useCallback(
        (event: React.MouseEvent) => world?.onMouseEnter(event),
        [world]
    );
    const onMouseLeave = useCallback(
        (event: React.MouseEvent) => world?.onMouseLeave(event),
        [world]
    );
    const onMouseMove = useCallback(
        (event: React.MouseEvent) => world?.onMouseMove(event),
        [world]
    );
    const onMouseUp = useCallback((event: React.MouseEvent) => world?.onMouseUp(event), [world]);
    const onMouseDown = useCallback(
        (event: React.MouseEvent) => world?.onMouseDown(event),
        [world]
    );
    const onWheel = useCallback((event: WheelEvent) => world?.onWheel(event), [world]);

    if (!visible) {
        return null;
    }

    return (
        <Container
            data-testid="editor-page"
            maxWidth={false}
            sx={{
                m: 0,
                p: 0,
                width: "100vw",
                height: "100vh",
                display: "grid",
                gridTemplateAreas: `
                    'title-bar title-bar'
                    'map panel'
                `,
                gridTemplateColumns: "1fr 320px",
                gridTemplateRows: "auto 1fr"
            }}
            disableGutters
        >
            <TitleBarComponent
                sx={{
                    gridArea: "title-bar"
                }}
            >
                <Container
                    maxWidth={false}
                    disableGutters
                    sx={{
                        display: "grid",
                        gridTemplateAreas: "'title actions id'",
                        gridTemplateColumns: "auto 1fr auto",
                        columnGap: 3,
                        height: statusBarHeight,
                        alignItems: "center"
                    }}
                >
                    <Typography sx={{ gridArea: "title" }} variant="h4">
                        Map Editor
                    </Typography>
                    <Box
                        sx={{ gridArea: "actions", display: "flex", gap: 1, justifySelf: "start" }}
                    >
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={onOpenNewMap}
                            disabled={!terrainPalette}
                        >
                            New Map...
                        </Button>
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={onOpenLoadMap}
                            disabled={!map}
                        >
                            Load Map...
                        </Button>
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={onOpenMapDetails}
                            disabled={!map}
                        >
                            Map Details...
                        </Button>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={renderMode}
                            onChange={(_event, value: RenderMode | null) => {
                                if (value) {
                                    setRenderMode(value);
                                }
                            }}
                            sx={{
                                ml: 1,
                                "& .MuiToggleButton-root": {
                                    color: "inherit",
                                    borderColor: "rgba(255, 255, 255, 0.5)",
                                    px: 1.5,
                                    py: 0.25
                                },
                                "& .MuiToggleButton-root.Mui-selected": {
                                    color: "black",
                                    backgroundColor: "white",
                                    "&:hover": {
                                        backgroundColor: "rgba(255, 255, 255, 0.85)"
                                    }
                                }
                            }}
                        >
                            <ToggleButton value={RenderMode.enum.MAP_MODE}>Map</ToggleButton>
                            <ToggleButton value={RenderMode.enum.FIRE_MODE}>Fire</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                    <Typography sx={{ gridArea: "id" }} variant="h5">
                        {editorId ?? "-"}
                    </Typography>
                </Container>
            </TitleBarComponent>
            <NewMapModal
                open={newMapOpen}
                hasUnsavedChanges={history.hasUnsavedChanges}
                terrainPalette={terrainPalette}
                onClose={onCloseNewMap}
                onConfirm={onConfirmNewMap}
            />
            <LoadMapModal
                open={loadMapOpen}
                hasUnsavedChanges={history.hasUnsavedChanges}
                maps={loadMapEntries}
                loading={loadMapLoading}
                onClose={onCloseLoadMap}
                onRequestList={onRequestLoadMapList}
                onConfirm={onConfirmLoadMap}
            />
            <MapDetailsModal
                open={mapDetailsOpen}
                mapWidth={map?.width ?? 32}
                mapHeight={map?.height ?? 32}
                terrainPalette={terrainPalette}
                onClose={onCloseMapDetails}
                onConfirm={onConfirmMapDetails}
            />
            <MapComponent
                renderMap={renderMap}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseDown={onMouseDown}
                onWheel={onWheel}
                sx={{ gridArea: "map" }}
            />
            <SidePanel
                sx={{
                    gridArea: "panel",
                    height: `calc(100vh - ${statusBarHeightAndPadding}px)`
                }}
            >
                <EditorSidePanel
                    map={map}
                    world={world as EditorWorld}
                    onSave={onSave}
                    savedMessage={savedMessage}
                    terrainPalette={terrainPalette}
                    furniturePalette={furniturePalette}
                    wallPalette={wallPalette}
                    itemPalette={itemPalette}
                    markersState={markersState}
                    markersSavedMessage={markersSavedMessage}
                    selectedTerrain={selectedTerrain}
                    onSelectedTerrainChange={setSelectedTerrain}
                    selectedFurniture={selectedFurniture}
                    onSelectedFurnitureChange={setSelectedFurniture}
                    selectedWall={selectedWall}
                    onSelectedWallChange={setSelectedWall}
                    selectedItem={selectedItem}
                    onSelectedItemChange={setSelectedItem}
                    onSelectMarkerSide={onSelectMarkerSide}
                    onSelectMarkerZone={onSelectMarkerZone}
                    onNewMarkerZone={onNewMarkerZone}
                    onDoneMarkerZone={onDoneMarkerZone}
                    onDeleteMarkerZone={onDeleteMarkerZone}
                    onUpdateMarkerZone={onUpdateMarkerZone}
                    onSaveMarkers={onSaveMarkers}
                    editorPanel={editorPanel}
                    onEditorPanelChange={setEditorPanel}
                    history={history}
                    onUndo={onUndo}
                    onRedo={onRedo}
                />
            </SidePanel>
        </Container>
    );
}
