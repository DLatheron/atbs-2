import { Container, SxProps } from "@mui/material";
import { ReactNode } from "react";

export interface SidePanelProps {
    children: ReactNode;
    sx: SxProps;
}

export function SidePanel({ children, sx }: SidePanelProps) {
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
