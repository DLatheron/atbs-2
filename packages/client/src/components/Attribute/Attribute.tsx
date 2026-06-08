import { Box, Typography } from "@mui/material";
import { ReactNode } from "react";

export interface AttributeComponentProps {
    id: string;
    label: string;
    text?: string | ReactNode;
    value?: string | number;
}

export function AttributeComponent({ label, text: textOrElement, value }: AttributeComponentProps) {
    const hasText = !!textOrElement;
    const hasValue = typeof value === "number" || typeof value === "string";

    return (
        <>
            <Box sx={{ gridColumn: 1, m: "auto 0" }}>
                <Typography variant="body1">{label}</Typography>
            </Box>
            <Box sx={{ gridColumn: 2, m: "auto 0 auto auto", color: "#666" }}>
                {hasText && typeof textOrElement === "string" ? (
                    <Typography variant="body2">{textOrElement}</Typography>
                ) : (
                    textOrElement
                )}
            </Box>
            <Box sx={{ gridColumn: 3, m: "auto 0", textAlign: "right" }}>
                {hasValue && <Typography variant="body1">{value}</Typography>}
            </Box>
        </>
    );
}
