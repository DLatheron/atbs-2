import { Button, Container } from "@mui/material";

export interface MapModePanelCompponentProps {
    visible: boolean;
    disabled: boolean;

    onEndTurn: () => void;
}

export function MapModePanelComponent({
    visible,
    disabled,
    onEndTurn
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
                height: "100vh",
                p: 1
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
