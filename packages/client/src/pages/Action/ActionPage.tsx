import { Container, Typography } from "@mui/material";
import { MapComponent } from "../../components/Map/MapComponent";
import { useCallback } from "react";
import { useWorld } from "../../hooks";
import { CanvasLoopProps } from "../../components/CanvasLoop";
import { useActionPage } from "./useActionPage";
import { MapModePanel, SidePanel } from "../../components/SidePanel";
import { TitleBarComponent } from "../../components/TitleBar";
import { UnitModePanel } from "../../components/SidePanel/UnitModePanel";
import { ErrorPanel } from "../../components/SidePanel/ErrorPanel";
import { FireModePanel } from "../../components/SidePanel/FireModePanel/FireModePanel";
import { MapMode } from "../../MapMode";

export interface ActionPageProps {
    visible: boolean;
}

export function ActionPage({ visible }: ActionPageProps) {
    const statusBarHeight = 60;
    const statusBarHeightAndPadding = statusBarHeight + 2 * 8;

    const {
        unit,
        unitWeapon,
        turn,
        side,
        tileInfo,
        sidePanelMode,
        error,
        disabled,
        isOnTarget,
        opportunityFire,
        onMove,
        onRotateTo,
        onChangeFireSelector,
        onEndMovement,
        onEndTurn,
        onEndError,
        onFireMode,
        onEndFireMode
    } = useActionPage();

    const { world } = useWorld();

    const renderMap = useCallback((props: CanvasLoopProps) => world.renderWorld(props), [world]);

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
                onWheel={onWheel}
                sx={{ gridArea: "map" }}
                disabled={disabled}
            ></MapComponent>
            {opportunityFire !== undefined && (
                <Typography
                    sx={{
                        gridArea: "map",
                        textAlign: "center",
                        mt: 2,
                        zIndex: 1,
                        textShadow:
                            "-3px -3px 0 black, 3px -3px 0 black, -3px 3px 0 black, 3px 3px 0 black",
                        color: "yellow",
                        userSelect: "none",
                        pointerEvents: "none"
                    }}
                    variant="h4"
                >
                    Opportunity Fire by {opportunityFire}
                </Typography>
            )}
            <SidePanel
                sx={{ gridArea: "panel", height: `calc(100vh - ${statusBarHeightAndPadding}px)` }}
            >
                <MapModePanel
                    visible={!error && sidePanelMode === MapMode.enum["map-mode"]}
                    disabled={disabled}
                    tileInfo={tileInfo}
                    onEndTurn={onEndTurn}
                    sx={{ height: `calc(100vh - ${statusBarHeightAndPadding}px)` }}
                />
                <UnitModePanel
                    visible={!error && sidePanelMode === MapMode.enum["unit-mode"]}
                    disabled={disabled}
                    unit={unit}
                    onMove={onMove}
                    onRotateTo={onRotateTo}
                    onEndMovement={onEndMovement}
                    onFireMode={onFireMode}
                    sx={{ height: `calc(100vh - ${statusBarHeightAndPadding}px)` }}
                />
                <FireModePanel
                    visible={!error && sidePanelMode === MapMode.enum["fire-mode"]}
                    disabled={disabled}
                    unit={unit}
                    unitWeapon={unitWeapon}
                    isOnTarget={isOnTarget}
                    opportunityFire={opportunityFire !== undefined}
                    onRotateTo={onRotateTo}
                    onChangeFireSelector={onChangeFireSelector}
                    onEndFireMode={onEndFireMode}
                    sx={{ height: `calc(100vh - ${statusBarHeightAndPadding}px)` }}
                />
                <ErrorPanel
                    error={error}
                    timeout={3000}
                    onEndError={onEndError}
                    sx={{ height: `calc(100vh - ${statusBarHeightAndPadding}px)` }}
                />
            </SidePanel>
        </Container>
    );
}
