import {
    FireModeWeaponSummary,
    FireSelector,
    FireMode,
    ItemId,
    FireModeDetails,
    FireModeExtendedDetails,
    FireModes
} from "@atbs/shared-data";
import {
    Box,
    Typography,
    ToggleButtonGroup,
    ToggleButton,
    styled,
    toggleButtonClasses,
    toggleButtonGroupClasses
} from "@mui/material";
import { startCase } from "lodash";
import { formatAccuracy, formatActionPoints } from "../../../helpers/formattingHelpers";
import { AttributesComponent } from "../../Attributes";
import { ImageComponent } from "../../Image";
import { useEffect, useState } from "react";

export interface FireModeComponentProps {
    actionPoints: number;
    weapon: FireModeWeaponSummary;
    onChangeFireSelector: (weaponId: ItemId, fireSelector: FireSelector) => void;
}

function getFireModeDetailsHelper(
    fireModes: FireModes,
    fireSelector: FireSelector
): FireModeDetails | FireModeExtendedDetails {
    if (fireSelector === FireSelector.enum.single && fireSelector in fireModes) {
        return fireModes[FireSelector.enum.single].fireModeDetails;
    } else if (fireSelector === FireSelector.enum.burst && fireSelector in fireModes) {
        return fireModes[FireSelector.enum.burst].fireModeDetails;
    } else if (fireSelector === FireSelector.enum.auto && fireSelector in fireModes) {
        return fireModes[FireSelector.enum.auto].fireModeDetails;
    }

    throw new Error(
        `Failed to get fire mode details for ${fireSelector} from ${JSON.stringify(fireModes)}`
    );
}

function getFireModeHelper(
    actionPoints: number,
    weapon: FireModeWeaponSummary
): FireMode | undefined {
    const fireModeDetails = getFireModeDetailsHelper(weapon.fireModes, weapon.fireSelector);
    if (actionPoints >= fireModeDetails.aimed.actionPoints) {
        return FireMode.enum.aimed;
    } else if (actionPoints >= fireModeDetails.snapshot.actionPoints) {
        return FireMode.enum.snapshot;
    }
}

function isFireModeAvailable(
    actionPoints: number,
    weapon: FireModeWeaponSummary,
    fireMode: FireMode
): boolean {
    const fireModeDetails = getFireModeDetailsHelper(weapon.fireModes, weapon.fireSelector);

    return actionPoints >= fireModeDetails[fireMode].actionPoints;
}

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    gap: "2rem",
    [`& .${toggleButtonGroupClasses.firstButton}, & .${toggleButtonGroupClasses.middleButton}`]: {
        borderBottomRightRadius: (theme.vars || theme).shape.borderRadius,
        borderBottomLeftRadius: (theme.vars || theme).shape.borderRadius
    },
    [`& .${toggleButtonGroupClasses.lastButton}, & .${toggleButtonGroupClasses.middleButton}`]: {
        borderTopRightRadius: (theme.vars || theme).shape.borderRadius,
        borderTopLeftRadius: (theme.vars || theme).shape.borderRadius,
        borderTop: `1px solid ${(theme.vars || theme).palette.divider}`
    },
    [`& .${toggleButtonGroupClasses.lastButton}.${toggleButtonClasses.disabled}, & .${toggleButtonGroupClasses.middleButton}.${toggleButtonClasses.disabled}`]:
        {
            borderTop: `1px solid ${(theme.vars || theme).palette.action.disabledBackground}`
        }
}));

export function FireModeComponent({
    actionPoints,
    weapon,
    onChangeFireSelector
}: FireModeComponentProps) {
    const [fireMode, setFireMode] = useState<FireMode | undefined>(
        getFireModeHelper(actionPoints, weapon)
    );

    useEffect(() => {
        if (fireMode !== undefined && !isFireModeAvailable(actionPoints, weapon, fireMode)) {
            setFireMode(getFireModeHelper(actionPoints, weapon));
        }
    }, [actionPoints, weapon, fireMode]);

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateAreas: `
                        'title'
                        'attributes'
                        'fire-selector'
                        'fire-selector-attributes'
                        'throw'
                    `,
                gridTemplateRows: "auto auto auto auto auto",
                rowGap: 2
            }}
        >
            <Typography variant="h6" sx={{ gridArea: "title", m: "auto" }}>
                {weapon.name}
            </Typography>
            <AttributesComponent
                sx={{ gridArea: "attributes" }}
                attributes={[
                    {
                        id: "ammo",
                        label: "Ammunition",
                        value: `${weapon.capacity ?? "-"}/${weapon.maxCapacity ?? "-"}`
                    },
                    {
                        id: "round",
                        label: "Loaded",
                        value: weapon.loadedRound ?? "-"
                    }
                ]}
            />
            <ToggleButtonGroup
                value={weapon.fireSelector}
                onChange={(_event, fireSelector) => onChangeFireSelector(weapon.id, fireSelector)}
                exclusive
                fullWidth
            >
                <ToggleButton
                    id="single-shot"
                    title="Single shot"
                    value={FireSelector.enum.single}
                    disabled={!("single" in weapon.fireModes)}
                >
                    <ImageComponent
                        images={[{ imageId: "fireSingle" }]}
                        width={40}
                        height={40}
                        disabled={!("single" in weapon.fireModes)}
                    />
                </ToggleButton>
                <ToggleButton
                    id="burst-fire"
                    title="Burst fire"
                    value={FireSelector.enum.burst}
                    disabled={!("burst" in weapon.fireModes)}
                >
                    <ImageComponent
                        images={[{ imageId: "fireBurst" }]}
                        width={40}
                        height={40}
                        disabled={!("burst" in weapon.fireModes)}
                    />
                </ToggleButton>
                <ToggleButton
                    id="full-auto"
                    title="Fulauto"
                    value={FireSelector.enum.auto}
                    disabled={!("auto" in weapon.fireModes)}
                >
                    <ImageComponent
                        images={[{ imageId: "fireAuto" }]}
                        width={40}
                        height={40}
                        disabled={!("auto" in weapon.fireModes)}
                    />
                </ToggleButton>
            </ToggleButtonGroup>
            <StyledToggleButtonGroup
                orientation="vertical"
                value={fireMode}
                onChange={(_event, fireMode) => setFireMode(fireMode)}
                exclusive
                sx={{ gap: 2 }}
            >
                {[FireMode.enum.aimed, FireMode.enum.snapshot].map((fireMode) => {
                    const fireModeDetails = getFireModeDetailsHelper(
                        weapon.fireModes,
                        weapon.fireSelector
                    )[fireMode];
                    const formattedAccuracy = formatAccuracy(fireModeDetails.accuracy);
                    const actionPointCost = fireModeDetails.actionPoints;
                    const actionPointCostPerRound =
                        "actionPointsPerRound" in fireModeDetails
                            ? fireModeDetails.actionPointsPerRound
                            : undefined;
                    const formattedActionPoints = formatActionPoints(
                        actionPointCost,
                        actionPointCostPerRound
                    );

                    return (
                        <Box
                            key={fireMode}
                            sx={{
                                display: "grid",
                                gridTemplateAreas: `
                                        'button'
                                        'attributes'
                                    `,
                                gridTemplateRows: "auto auto",
                                rowGap: 2
                            }}
                        >
                            <ToggleButton
                                id={fireMode}
                                title={startCase(fireMode)}
                                value={fireMode}
                                sx={{ gridArea: "button" }}
                                disabled={actionPoints < actionPointCost}
                            >
                                {startCase(fireMode)}
                            </ToggleButton>
                            <AttributesComponent
                                sx={{ gridArea: "attributes" }}
                                attributes={[
                                    {
                                        id: "accuracy",
                                        label: "Accuracy",
                                        value: formattedAccuracy
                                    },
                                    {
                                        id: "action-points",
                                        label: "Action Points",
                                        value: formattedActionPoints
                                    }
                                ]}
                            />
                        </Box>
                    );
                })}
            </StyledToggleButtonGroup>
        </Box>
    );
}
