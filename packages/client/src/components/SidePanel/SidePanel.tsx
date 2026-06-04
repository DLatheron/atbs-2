import { Container, SxProps } from "@mui/material";
import { ReactNode } from "react";

export interface SidePanelComponentProps {
    children: ReactNode;
    sx: SxProps;
}

export function SidePanelComponent({ children, sx }: SidePanelComponentProps) {
    return (
        <Container
            data-testid="side-panel-component"
            disableGutters
            maxWidth={false}
            sx={{
                m: 0,
                p: 0,
                height: "100vh",
                ...sx
            }}
        >
            {children}
        </Container>
    );
}
