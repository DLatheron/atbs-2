import {
    FireMode,
    FireModeDetails,
    FireModeExtendedDetails,
    FireModeItemSummary,
    FireModes,
    FireModeWeaponSummary,
    FireSelector
} from "@atbs/shared-data";
import {
    Box,
    styled,
    SxProps,
    Tab,
    Tabs,
    ToggleButton,
    toggleButtonClasses,
    ToggleButtonGroup,
    toggleButtonGroupClasses,
    Typography
} from "@mui/material";
import { AttributesComponent } from "../Attributes";
import { useState } from "react";
import { ImageComponent } from "../Image";
import { startCase } from "lodash";
import { formatAccuracy, formatActionPoints } from "../../helpers/formattingHelpers";

export interface FireModesComponentProps {
    unitWeapon: FireModeItemSummary;
    sx: SxProps;
}

function getInitialFireSelector(weapon?: FireModeWeaponSummary): FireSelector | undefined {
    if (!weapon) {
        return undefined;
    }

    if (FireSelector.enum.single in weapon.fireModes) {
        return FireSelector.enum.single;
    } else if (FireSelector.enum.burst in weapon.fireModes) {
        return FireSelector.enum.burst;
    } else {
        return FireSelector.enum.auto;
    }
}

function getFireModeDetails(
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

export function FireModesComponent({ unitWeapon, sx }: FireModesComponentProps) {
    const surroundProps = {
        borderRadius: 2,
        border: "1px black solid",
        backgroundColor: "beige",
        p: 0
    };

    const initialWeaponIndex = 0;
    const [weaponIndex, setWeaponIndex] = useState(initialWeaponIndex);
    const [fireSelector, setFireSelector] = useState<FireSelector | undefined>(
        getInitialFireSelector(unitWeapon.weapons?.[initialWeaponIndex])
    );
    const [fireMode, setFireMode] = useState<FireMode>(FireMode.enum.aimed);

    console.dir(unitWeapon);

    return (
        <Box
            sx={{
                ...surroundProps,
                ...sx
            }}
        >
            <Tabs
                value={weaponIndex}
                onChange={(_event, newValue) => {
                    setFireSelector(getInitialFireSelector(unitWeapon.weapons[newValue]));
                    setWeaponIndex(newValue);
                }}
                variant="fullWidth"
                textColor="primary"
                indicatorColor="primary"
            >
                {unitWeapon.weapons.map((weapon: FireModeWeaponSummary, index: number) => (
                    <Tab
                        value={index}
                        label={<Typography variant="h6">{weapon.shortName}</Typography>}
                    />
                ))}
            </Tabs>
            <Box sx={{ p: 1 }}>
                {unitWeapon.weapons.map((weapon: FireModeWeaponSummary, index: number) => {
                    if (weaponIndex !== index || fireSelector === undefined) {
                        return null;
                    }

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
                                value={fireSelector}
                                onChange={(_event, fireSelector) => setFireSelector(fireSelector)}
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
                                    const fireModeDetails = getFireModeDetails(
                                        weapon.fireModes,
                                        fireSelector
                                    )[fireMode];
                                    const formattedAccuracy = formatAccuracy(
                                        fireModeDetails.accuracy
                                    );
                                    const actionPoints = fireModeDetails.actionPoints;
                                    const actionPointsPerRound =
                                        "actionPointsPerRound" in fireModeDetails
                                            ? fireModeDetails.actionPointsPerRound
                                            : undefined;
                                    const formattedActionPoints = formatActionPoints(
                                        actionPoints,
                                        actionPointsPerRound
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
                })}
            </Box>
        </Box>
    );
}
