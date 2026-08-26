import { UnitId, UnitSummary } from "@atbs/shared-data";
import { Button, Container, Stack, SxProps } from "@mui/material";
import { ITilePos } from "@atbs/maths";
import { useMemo } from "react";
import { useKeyboard } from "../../../hooks";
import { DeploymentPalette } from "../../DeploymentPalette";

export interface DeploymentModePanelProps {
    visible: boolean;
    disabled: boolean;
    units: UnitSummary[];
    unitDeployment: Record<UnitId, ITilePos | null>;

    canEndDeployment: boolean;
    onEndDeployment: () => void;

    sx?: SxProps;
}

export function DeploymentModePanel({
    visible,
    disabled,
    units,
    unitDeployment,
    canEndDeployment,
    onEndDeployment,
    sx
}: DeploymentModePanelProps) {
    const keyMap = useMemo(
        () => ({
            Escape: () => {
                if (canEndDeployment) {
                    onEndDeployment();
                }
            }
        }),
        [onEndDeployment, canEndDeployment]
    );

    useKeyboard({
        keyMap,
        disabled: !visible || disabled
    });

    if (!visible) {
        return null;
    }
    if (units.length === 0) {
        return null;
    }

    return (
        <Container
            data-testid="deployment-panel"
            disableGutters
            maxWidth={false}
            sx={{
                display: "grid",
                gridTemplateAreas: `
                    'panel-info'
                    'bottom-bar'
                `,
                gridTemplateRows: "1fr auto",
                rowGap: 0,
                p: 0,
                ...sx
            }}
        >
            <Stack spacing={1} sx={{ gridArea: "panel-info", p: 1, overflowY: "scroll" }}>
                <DeploymentPalette units={units} unitDeployment={unitDeployment} />
            </Stack>
            <Stack spacing={1} sx={{ gridArea: "bottom-bar", px: 1, pb: 1 }}>
                <Button
                    id="end-deployment"
                    title="End deployment phase"
                    variant="outlined"
                    disabled={disabled || !canEndDeployment}
                    onClick={onEndDeployment}
                >
                    End Deployment
                </Button>
            </Stack>
        </Container>
    );
}
