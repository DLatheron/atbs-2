import { Container, SxProps } from "@mui/material";
import { ReactNode } from "react";

export interface TitleBarComponentProps {
    children: ReactNode;
    sx?: SxProps;
}

export function TitleBarComponent({ children, sx }: TitleBarComponentProps) {
    return (
        <Container
            data-testid="title-bar-component"
            maxWidth={false}
            disableGutters
            sx={{
                p: 1,
                backgroundColor: "black",
                color: "white",
                ...sx
            }}
        >
            {children}
        </Container>
    );
}
