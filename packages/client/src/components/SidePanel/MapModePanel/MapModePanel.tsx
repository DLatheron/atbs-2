import { TileInfo } from "@atbs/shared-data";
import { Button, Container, Stack, SxProps } from "@mui/material";
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
                    'panel-info'
                    'bottom-bar'
                `,
                gridTemplateRows: "1fr auto",
                rowGap: 0,
                p: 0,
                ...sx
            }}
        >
            <Stack spacing={1} sx={{ gridArea: "panel-info", p: 1, overflowY: "scroll" }}>
                <TileInfoComponent tileInfo={tileInfo} />
            </Stack>
            <Stack spacing={1} sx={{ gridArea: "bottom-bar", px: 1, pb: 1 }}>
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
            </Stack>
        </Container>
    );
}
