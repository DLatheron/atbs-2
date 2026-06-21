import {
    FireModeWeaponSummary,
    FireSelector,
    FireMode,
    ItemId,
    FireModeDetails,
    FireModeExtendedDetails,
    FireModes,
    FireModeEx,
    FireModeItemSummary,
    UnitSummary,
    Action
} from "@atbs/shared-data";
import {
    Typography,
    ToggleButtonGroup,
    ToggleButton,
    styled,
    toggleButtonClasses,
    toggleButtonGroupClasses,
    Stack
} from "@mui/material";
import { startCase } from "lodash";
import {
    formatAccuracy,
    formatActionPoints,
    formatWeight
} from "../../../helpers/formattingHelpers";
import { AttributesComponent } from "../../Attributes";
import { ImageComponent } from "../../Image";
import { useEffect, useState } from "react";
import { useWorld } from "../../../hooks";

export interface FireModeComponentProps {
    unit: UnitSummary;
    unitWeapon: FireModeItemSummary;
    weapon: FireModeWeaponSummary | null;
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

/**
 * Determine the base fire/throw mode.
 */
function getModeHelper(unit: UnitSummary, weapon: FireModeWeaponSummary | null): FireModeEx {
    const { value: actionPoints } = unit.attributes.actionPoints;
    if (weapon) {
        const fireModeDetails = getFireModeDetailsHelper(weapon.fireModes, weapon.fireSelector);

        if (actionPoints >= fireModeDetails[FireMode.enum.aimed].actionPoints) {
            return FireModeEx.enum.aimed;
        } else if (actionPoints >= fireModeDetails[FireMode.enum.snapshot].actionPoints) {
            return FireModeEx.enum.snapshot;
        }
    }

    if (actionPoints >= unit.actions[Action.enum.throw].actionPoints) {
        return FireModeEx.enum.throw;
    }

    return FireModeEx.enum.none;
}

/**
 * Check if the currently selected mode is available.
 */
function isModeAvailable(
    mode: FireModeEx,
    unit: UnitSummary,
    weapon: FireModeWeaponSummary | null
): boolean {
    const { value: actionPoints } = unit.attributes.actionPoints;

    switch (mode) {
        case FireModeEx.enum.none:
            return true;

        case FireModeEx.enum.throw:
            return actionPoints >= unit.actions[Action.enum.throw].actionPoints;

        case FireModeEx.enum.aimed:
        case FireModeEx.enum.snapshot: {
            if (!weapon) {
                return false;
            }

            const fireModeDetails = getFireModeDetailsHelper(weapon.fireModes, weapon.fireSelector);

            return actionPoints >= fireModeDetails[mode].actionPoints;
        }
    }
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
    unit,
    unitWeapon,
    weapon,
    onChangeFireSelector
}: FireModeComponentProps) {
    const { value: actionPoints } = unit.attributes.actionPoints;

    const { world } = useWorld();
    const [mode, setFireModeEx] = useState<FireModeEx>(getModeHelper(unit, weapon));

    useEffect(() => {
        if (!isModeAvailable(mode, unit, weapon)) {
            const newMode = getModeHelper(unit, weapon);
            setFireModeEx(newMode);
            world.fireModeEx = newMode;
        }
    }, [mode, unit, weapon, world]);

    return (
        <Stack spacing={1}>
            <Typography variant="h6" sx={{ m: "auto", textAlign: "center" }}>
                {weapon?.name || unitWeapon.name}
            </Typography>
            {weapon && (
                <>
                    <AttributesComponent
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
                        onChange={(_event, fireSelector) =>
                            onChangeFireSelector(weapon.id, fireSelector)
                        }
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
                </>
            )}
            <StyledToggleButtonGroup
                orientation="vertical"
                value={mode}
                onChange={(_event, fireModeEx) => {
                    setFireModeEx(fireModeEx);
                    world.fireModeEx = fireModeEx;
                }}
                exclusive
                sx={{ gap: 2 }}
            >
                {weapon &&
                    [FireModeEx.enum.aimed, FireModeEx.enum.snapshot].map((fireMode) => {
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
                            <Stack key={fireMode} spacing={1}>
                                <ToggleButton
                                    id={fireMode}
                                    title={startCase(fireMode)}
                                    value={fireMode}
                                    disabled={actionPoints < actionPointCost}
                                >
                                    {startCase(fireMode)}
                                </ToggleButton>
                                <AttributesComponent
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
                            </Stack>
                        );
                    })}
                {FireModeEx.enum.throw in unit.actions && (
                    <Stack key={mode} spacing={1}>
                        <ToggleButton
                            id={FireModeEx.enum.throw}
                            title={startCase(FireModeEx.enum.throw)}
                            value={FireModeEx.enum.throw}
                            disabled={actionPoints < unit.actions[Action.enum.throw].actionPoints}
                        >
                            {startCase(FireModeEx.enum.throw)}
                        </ToggleButton>
                        <AttributesComponent
                            attributes={[
                                {
                                    id: "weight",
                                    label: "Weight",
                                    value: formatWeight(unitWeapon.weight)
                                },
                                {
                                    id: "accuracy",
                                    label: "Accuracy",
                                    value: formatAccuracy(unit.actions[Action.enum.throw].accuracy)
                                },
                                {
                                    id: "action-points",
                                    label: "Action Points",
                                    value: formatActionPoints(
                                        unit.actions[Action.enum.throw].actionPoints
                                    )
                                }
                            ]}
                        />
                    </Stack>
                )}
            </StyledToggleButtonGroup>
        </Stack>
    );
}
