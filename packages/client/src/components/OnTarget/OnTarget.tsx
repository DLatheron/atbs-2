import { useEffect, useState } from "react";
import { Container, SxProps, Typography } from "@mui/material";

export interface OnTargetComponentProps {
    onTarget: boolean;
    show: boolean;
    sx: SxProps;
}

export function OnTargetComponent({ onTarget, show, sx }: OnTargetComponentProps) {
    const [isOnTarget, setIsOnTarget] = useState(onTarget);
    const [transition, setTransition] = useState("on-target-component--hidden");

    useEffect(() => {
        setIsOnTarget(onTarget);
    }, [onTarget]);

    useEffect(() => {
        if (transition === "on-target-component--visible" && !show) {
            setTransition("on-target-component--hidden");
        } else if (transition === "on-target-component--hidden" && show) {
            setTransition("on-target-component--visible");
        }
    }, [show, transition]);

    return (
        <Container data-testid="on-target-component" className={transition} sx={sx}>
            <Typography variant="h1">{isOnTarget ? "🎯 On Target" : "◎ Off Target"}</Typography>
        </Container>
    );
}
