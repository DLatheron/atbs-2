import { Box, Collapse, SxProps, Typography } from "@mui/material";

export interface DisorientedComponentProps {
    disorientation: number;
    sx?: SxProps;
}

export function DisorientedComponent({ disorientation, sx }: DisorientedComponentProps) {
    return (
        <Box data-testid="disoriented-component" sx={{ m: 0, p: 0 }}>
            <Collapse in={disorientation > 0}>
                <Box
                    sx={{
                        borderRadius: 2,
                        border: "1px black solid",
                        backgroundColor: "darkgreen",
                        color: "yellow",
                        rowGap: 1,
                        p: 1,
                        textAlign: "center",
                        ...sx
                    }}
                >
                    <Typography variant="h5">💫 Disoriented</Typography>
                </Box>
            </Collapse>
        </Box>
    );
}
