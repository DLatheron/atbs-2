import { Container, Typography } from "@mui/material";
import { MapComponent } from "../../components/Map/MapComponent";
import { useCallback, useState } from "react";
import { useWorld } from "../../hooks";
import { CanvasLoopComponentProps } from "../../components/CanvasLoop";
import { useActionPage } from "./useActionPage";
import { MapModePanelComponent, SidePanelComponent } from "../../components/SidePanel";
import { TitleBarComponent } from "../../components/TitleBar";

export interface ActionPageProps {
    visible: boolean;
}

export function ActionPage({ visible }: ActionPageProps) {
    const statusBarHeight = 60;

    const [sidePanelMode] = useState<"map-mode" | "move-mode" | "fire-mode">("map-mode");
    const { map, unit, turn, side, onEndTurn } = useActionPage();
    if (!map) {
        console.info("No map");
    } else {
        console.info("!!!Map present!!!");
    }
    console.info("unit", unit);

    const { world } = useWorld();

    const renderMap = useCallback(
        (props: CanvasLoopComponentProps) => world.renderWorld(props),
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
    const onClick = useCallback((event: React.MouseEvent) => world?.onClick(event), [world]);
    const onDoubleClick = useCallback(
        (event: React.MouseEvent) => world?.onDoubleClick(event),
        [world]
    );

    if (!visible) {
        return null;
    }

    return (
        <Container
            data-testid="action-page"
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
                gridTemplateColumns: "1fr 300px",
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
                        gridTemplateAreas: "'title side turn' 'title vps turn'",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        columnGap: 3,
                        height: statusBarHeight
                    }}
                >
                    <Typography sx={{ m: "auto 0", gridArea: "title" }} variant="h4">
                        ATBS
                    </Typography>
                    <Typography sx={{ m: "auto", gridArea: "side" }} variant="h5">
                        {side?.name ?? "-"}
                    </Typography>
                    <Typography sx={{ m: "auto", gridArea: "vps" }} variant="body1">
                        Victory Points: {side?.victoryPoints ?? "-"}
                    </Typography>
                    <Typography sx={{ m: "auto 0 auto auto", gridArea: "turn" }} variant="h5">
                        Turn: {turn ?? "-"}
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
                onClick={onClick}
                onDoubleClick={onDoubleClick}
                sx={{ gridArea: "map " }}
                // cursor={state.cursor}
                // disabled={false}
            ></MapComponent>
            <SidePanelComponent
                sx={{ gridArea: "panel", height: `calc(100vh - ${statusBarHeight})` }}
            >
                <MapModePanelComponent
                    visible={sidePanelMode === "map-mode"}
                    disabled={false}
                    onEndTurn={onEndTurn}
                />
            </SidePanelComponent>
        </Container>
    );
}
