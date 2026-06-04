import { Button, Container, SxProps } from "@mui/material";

export interface MapModePanelCompponentProps {
    visible: boolean;
    disabled: boolean;

    onEndTurn: () => void;

    sx?: SxProps;
}

export function MapModePanelComponent({
    visible,
    disabled,
    onEndTurn,
    sx
}: MapModePanelCompponentProps) {
    if (!visible) {
        return null;
    }

    return (
        <Container
            disableGutters
            maxWidth={false}
            sx={{
                display: "grid",
                gridTemplateAreas: `
                'panel'
                'exit-button'
                `,
                gridTemplateRows: "1fr auto",
                rowGap: 2,
                height: "100%",
                p: 1,
                ...sx
            }}
        >
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
