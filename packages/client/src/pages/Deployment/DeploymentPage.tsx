import { Container, Typography } from "@mui/material";
import { useDeploymentPage } from "./useDeploymentPage";
import { useWorld } from "../../hooks";
import {
    CanvasLoopProps,
    DeploymentModePanel,
    MapComponent,
    SidePanel,
    TitleBarComponent
} from "../../components";
import { useCallback } from "react";

export interface DeploymentPageProps {
    visible: boolean;
}

export function DeploymentPage({ visible }: DeploymentPageProps) {
    const statusBarHeight = 60;
    const statusBarHeightAndPadding = statusBarHeight + 2 * 8;

    const { side, disabled, units, unitDeployment, canEndDeployment, onEndDeploymentPhase } =
        useDeploymentPage();

    const { world } = useWorld();
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
    const onClick = useCallback((event: React.MouseEvent) => world?.onClick(event), [world]);
    const onDoubleClick = useCallback(
        (event: React.MouseEvent) => world?.onDoubleClick(event),
        [world]
    );
    const onWheel = useCallback((event: WheelEvent) => world?.onWheel(event), [world]);

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
                onWheel={onWheel}
                sx={{ gridArea: "map" }}
                disabled={disabled}
            ></MapComponent>
            <SidePanel
                sx={{ gridArea: "panel", height: `calc(100vh - ${statusBarHeightAndPadding}px)` }}
            >
                <DeploymentModePanel
                    visible
                    disabled={disabled}
                    units={units}
                    unitDeployment={unitDeployment}
                    canEndDeployment={canEndDeployment}
                    onEndDeployment={onEndDeploymentPhase}
                    sx={{ height: `calc(100vh - ${statusBarHeightAndPadding}px)` }}                    
                />
            </SidePanel>
        </Container>
    );
}
