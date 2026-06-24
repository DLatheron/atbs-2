import { useEffect, useState } from "react";
import { Box, Collapse, SxProps, Typography } from "@mui/material";
import { OnTarget } from "@atbs/shared-data";

export interface OnTargetComponentProps {
    isOnTarget: OnTarget;
    sx?: SxProps;
}

export function OnTargetComponent({ isOnTarget, sx }: OnTargetComponentProps) {
    const [localOnTarget, setLocalOnTarget] = useState<
        typeof OnTarget.enum.onTarget | typeof OnTarget.enum.offTarget
    >();

    useEffect(() => {
        if (isOnTarget !== OnTarget.enum.none) {
            setLocalOnTarget(isOnTarget);
        }
    }, [isOnTarget]);

    return (
        <Box>
            <Collapse in={isOnTarget !== OnTarget.enum.none}>
                <Box
                    sx={{
                        borderRadius: 2,
                        border: "1px black solid",
                        backgroundColor:
                            localOnTarget === OnTarget.enum.onTarget ? "limegreen" : "red",
                        color: localOnTarget === OnTarget.enum.onTarget ? "black" : "white",
                        rowGap: 1,
                        p: 1,
                        textAlign: "center",
                        ...sx
                    }}
                >
                    <Typography variant="h5">
                        {localOnTarget === OnTarget.enum.onTarget
                            ? "🎯 On Target"
                            : "❌ Off Target"}
                    </Typography>
                </Box>
            </Collapse>
        </Box>
    );
}
