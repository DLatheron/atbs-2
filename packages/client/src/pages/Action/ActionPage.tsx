import { Container } from "@mui/material";
import { MapComponent } from "../../components/Map/MapComponent";
import { useCallback } from "react";
import { useWorld } from "../../hooks";
import { CanvasLoopComponentProps } from "../../components/CanvasLoop";
// import { CanvasLoopComponentProps } from "../../components/CanvasLoop";

export interface ActionPageProps {
    visible: boolean;
}

export function ActionPage({ visible }: ActionPageProps) {
    // const { onTurnPage } = useTurnsPage();

    const { world } = useWorld();

    const renderMap = useCallback(
        (props: CanvasLoopComponentProps) => world.renderWorld(props),
        [world]
    );
    // const renderMap = useCallback((props: CanvasLoopComponentProps) => gameWorld?.renderWorld(props), [gameWorld]);

    if (!visible) {
        return null;
    }

    return (
        <Container
            data-testid="action-page"
            maxWidth={false}
            sx={{ m: 0, p: 0, width: "100vw", height: "100vh" }}
        >
            <MapComponent
                renderMap={renderMap}
                // onMouseEnter={onMouseEnter}
                // onMouseLeave={onMouseLeave}
                // onMouseMove={onMouseMove}
                // onMouseUp={onMouseUp}
                // onMouseDown={onMouseDown}
                // onClick={onClick}
                // onDoubleClick={onDoubleClick}
                // cursor={state.cursor}
                // disabled={false}
            ></MapComponent>
        </Container>
    );
}
