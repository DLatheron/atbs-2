import { TileInfo, UnitDeploymentWire, UnitId, UnitSummary } from "@atbs/shared-data";
import { Box, Button, Collapse, Container, Grid, Stack, SxProps, Typography } from "@mui/material";
import { useMemo } from "react";
import { useKeyboard } from "../../../hooks";
import { DeploymentPalette } from "../../DeploymentPalette";
import { UnitDetailsComponent } from "../../UnitDetails";
import { TileInfoComponent } from "../../TileInfo";
import { ImageComponent } from "../../Image";

const ACTION_ICON_SIZE = 40;

export interface DeploymentModePanelProps {
    visible: boolean;
    disabled: boolean;
    units: UnitSummary[];
    unitDeployment: Record<UnitId, UnitDeploymentWire>;
    selectedUnitId: UnitId | null;
    tileInfo: TileInfo | null;

    canEndDeployment: boolean;
    endDeploymentBlockedReasons: string[];
    onEndDeployment: () => void;
    onSelectUnit: (unitId: UnitId, options?: { scrollToUnit?: boolean }) => void;
    onDeployRandom: (unitId: UnitId) => void;
    onUndeploy: (unitId: UnitId) => void;
    onPreviousUnit: () => void;
    onNextUnit: () => void;
    onDeployAll: () => void;
    onUndeployAll: () => void;

    sx?: SxProps;
}

function DeploymentActionButton({
    id,
    title,
    imageId,
    disabled,
    onClick,
    sx
}: {
    id: string;
    title: string;
    imageId: string;
    disabled?: boolean;
    onClick: () => void;
    sx?: SxProps;
}) {
    return (
        <Button
            id={id}
            title={title}
            variant="outlined"
            disabled={disabled}
            onClick={onClick}
            sx={{ aspectRatio: 1, p: 0, minWidth: 0, ...sx }}
        >
            <ImageComponent
                images={[{ imageId }]}
                width={ACTION_ICON_SIZE}
                height={ACTION_ICON_SIZE}
                disabled={disabled}
            />
        </Button>
    );
}

export function DeploymentModePanel({
    visible,
    disabled,
    units,
    unitDeployment,
    selectedUnitId,
    tileInfo,
    canEndDeployment,
    endDeploymentBlockedReasons,
    onEndDeployment,
    onSelectUnit,
    onDeployRandom,
    onUndeploy,
    onPreviousUnit,
    onNextUnit,
    onDeployAll,
    onUndeployAll,
    sx
}: DeploymentModePanelProps) {
    const hasUndeployedUnits = useMemo(
        () => units.some((unit) => unitDeployment[unit.id]?.location == null),
        [units, unitDeployment]
    );
    const hasDeployedUnits = useMemo(
        () => units.some((unit) => unitDeployment[unit.id]?.location != null),
        [units, unitDeployment]
    );

    const keyMap = useMemo(
        () => ({
            Escape: () => {
                if (canEndDeployment) {
                    onEndDeployment();
                }
            },
            KeyP: () => onPreviousUnit(),
            KeyN: () => onNextUnit()
        }),
        [onEndDeployment, canEndDeployment, onPreviousUnit, onNextUnit]
    );

    useKeyboard({
        keyMap,
        disabled: !visible || disabled
    });

    const selectedUnit = useMemo(
        () => units.find((unit) => unit.id === selectedUnitId) ?? null,
        [units, selectedUnitId]
    );

    if (!visible) {
        return null;
    }
    if (units.length === 0) {
        return null;
    }

    const endDeploymentDisabled = disabled || !canEndDeployment;
    const showDeploymentRequirements = endDeploymentBlockedReasons.length > 0;

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
            <Stack
                spacing={1}
                sx={{ gridArea: "panel-info", p: 1, overflowY: "auto", minHeight: 0 }}
            >
                <DeploymentPalette
                    units={units}
                    unitDeployment={unitDeployment}
                    selectedUnitId={selectedUnitId}
                    disabled={disabled}
                    onSelectUnit={onSelectUnit}
                    onDeployRandom={onDeployRandom}
                    onUndeploy={onUndeploy}
                    sx={{ minHeight: 200 }}
                />
                {selectedUnit && (
                    <UnitDetailsComponent
                        unit={selectedUnit}
                        item={selectedUnit.itemInUse ?? undefined}
                        noImages={true}
                        noItemDescription={true}
                    />
                )}
                <TileInfoComponent tileInfo={tileInfo} terrainAndFurnitureOnly />
            </Stack>
            <Stack spacing={1} sx={{ gridArea: "bottom-bar", px: 1, pb: 1 }}>
                <Grid
                    sx={{
                        display: "grid",
                        gridTemplateAreas: "'prev auto undeploy next'",
                        gridTemplateColumns: "1fr 1fr 1fr 1fr"
                    }}
                >
                    <DeploymentActionButton
                        id="deployment-prev-unit"
                        title="Previous unit"
                        imageId="prev"
                        disabled={disabled || units.length <= 1}
                        onClick={onPreviousUnit}
                        sx={{
                            gridArea: "prev",
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: 0
                        }}
                    />
                    <DeploymentActionButton
                        id="deployment-auto-deploy"
                        title="Auto-deploy all units"
                        imageId="autoDeploy"
                        disabled={disabled || !hasUndeployedUnits}
                        onClick={onDeployAll}
                        sx={{ gridArea: "auto", borderRadius: 0 }}
                    />
                    <DeploymentActionButton
                        id="deployment-undeploy-all"
                        title="Undeploy all units"
                        imageId="undeployAll"
                        disabled={disabled || !hasDeployedUnits}
                        onClick={onUndeployAll}
                        sx={{ gridArea: "undeploy", borderRadius: 0 }}
                    />
                    <DeploymentActionButton
                        id="deployment-next-unit"
                        title="Next unit"
                        imageId="next"
                        disabled={disabled || units.length <= 1}
                        onClick={onNextUnit}
                        sx={{
                            gridArea: "next",
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0
                        }}
                    />
                </Grid>
                <Collapse in={showDeploymentRequirements}>
                    <Box
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            px: 1.5,
                            py: 1,
                            mb: 1,
                            bgcolor: "action.hover"
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                            Requirements
                        </Typography>
                        <Box
                            component="ul"
                            sx={{
                                m: 0,
                                pl: 2.5,
                                "& li": { typography: "body2" }
                            }}
                        >
                            {endDeploymentBlockedReasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                            ))}
                        </Box>
                    </Box>
                </Collapse>
                <Button
                    id="end-deployment"
                    title="End deployment phase"
                    variant="outlined"
                    disabled={endDeploymentDisabled}
                    onClick={onEndDeployment}
                    fullWidth
                >
                    End Deployment
                </Button>
            </Stack>
        </Container>
    );
}
