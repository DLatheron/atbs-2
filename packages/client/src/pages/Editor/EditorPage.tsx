import { Container, Typography } from "@mui/material";
import { useCallback } from "react";
import { EditorId } from "@atbs/shared-data";
import { CanvasLoopProps, MapComponent, SidePanel, TitleBarComponent } from "../../components";
import { useEditorWorld } from "../../hooks";
import { EditorWorld } from "../../EditorWorld";
import { useEditorPage } from "./useEditorPage";
import { EditorSidePanel } from "./EditorSidePanel";

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
        terrainPalette,
        furniturePalette,
        wallPalette,
        itemPalette,
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
        history,
        onUndo,
        onRedo
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
                        gridTemplateAreas: "'title id'",
                        gridTemplateColumns: "1fr 1fr",
                        columnGap: 3,
                        height: statusBarHeight
                    }}
                >
                    <Typography sx={{ m: "auto 0", gridArea: "title" }} variant="h4">
                        Map Editor
                    </Typography>
                    <Typography sx={{ m: "auto", gridArea: "id" }} variant="h5">
                        {editorId ?? "-"}
                    </Typography>
                </Container>
            </TitleBarComponent>
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
                    selectedTerrain={selectedTerrain}
                    onSelectedTerrainChange={setSelectedTerrain}
                    selectedFurniture={selectedFurniture}
                    onSelectedFurnitureChange={setSelectedFurniture}
                    selectedWall={selectedWall}
                    onSelectedWallChange={setSelectedWall}
                    selectedItem={selectedItem}
                    onSelectedItemChange={setSelectedItem}
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
