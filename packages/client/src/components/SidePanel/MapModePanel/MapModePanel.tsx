import { TileInfo } from "@atbs/shared-data";
import { Button, Container, SxProps } from "@mui/material";
import { TileInfoComponent } from "../../TileInfo";

export interface MapModePanelProps {
    visible: boolean;
    disabled: boolean;
    tileInfo: TileInfo | null;

    onEndTurn: () => void;

    sx?: SxProps;
}

export function MapModePanel({ visible, disabled, tileInfo, onEndTurn, sx }: MapModePanelProps) {
    if (!visible) {
        return null;
    }

    return (
        <Container
            data-testid="map-mode-panel"
            disableGutters
            maxWidth={false}
            sx={{
                display: "grid",
                gridTemplateAreas: `
                    'tileInfo'
                    'exit-button'
                `,
                gridTemplateRows: "1fr auto",
                rowGap: 2,
                p: 1,
                ...sx
            }}
        >
            <Container
                disableGutters
                maxWidth={false}
                sx={{ gridArea: "tileInfo", overflow: "auto" }}
            >
                <TileInfoComponent tileInfo={tileInfo} />
            </Container>
            <Button
                id="end-turn"
                title="End the current side's turn"
                variant="outlined"
                disabled={disabled}
                onClick={onEndTurn}
                sx={{ gridArea: "exit-button" }}
            >
                End Turn
            </Button>
        </Container>
    );
}
