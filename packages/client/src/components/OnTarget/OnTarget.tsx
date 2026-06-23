import { useEffect, useState } from "react";
import { Box, Collapse, SxProps, Typography } from "@mui/material";
import { OnTarget } from "@atbs/shared-data";
import { useInterval } from "../../hooks";

export interface OnTargetComponentProps {
    isOnTarget: OnTarget;
    setIsOnTarget: (onTarget: OnTarget) => void;
    timeout?: number;
    sx?: SxProps;
}

export function OnTargetComponent({
    isOnTarget,
    setIsOnTarget,
    timeout = 3000,
    sx
}: OnTargetComponentProps) {
    const [localOnTarget, setLocalOnTarget] = useState<
        typeof OnTarget.enum.onTarget | typeof OnTarget.enum.offTarget
    >();
    const [counter, setCounter] = useState<number>(0);

    useEffect(() => {
        if (isOnTarget !== OnTarget.enum.none) {
            setLocalOnTarget(isOnTarget);
        }
    }, [isOnTarget]);

    useEffect(() => {
        if (isOnTarget === OnTarget.enum.none) {
            return;
        }

        setCounter(timeout / 1000 - 1);
    }, [isOnTarget, timeout]);

    useInterval(
        () => {
            if (isOnTarget === OnTarget.enum.none) {
                return;
            }

            setCounter(counter - 1);
            if (counter <= 0) {
                setIsOnTarget(OnTarget.enum.none);
            }
        },
        isOnTarget !== OnTarget.enum.none ? 1000 : undefined
    );

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
