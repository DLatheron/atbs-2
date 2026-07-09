import {
    FireModeWeaponSummary,
    FireSelector,
    ItemId,
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
import {
    FIRE_MODE_EX_LOOKUP,
    formatAccuracy,
    formatActionPoints,
    formatWeight
} from "../../../helpers/formattingHelpers";
import { AttributesComponent } from "../../Attributes";
import { ImageComponent } from "../../Image";
import { getFireModeDetailsHelper } from "../../../helpers/fireModeHelpers";

export interface FireModeComponentProps {
    unit: UnitSummary;
    unitWeapon: FireModeItemSummary;
    weapon: FireModeWeaponSummary | null;
    fireModeEx: FireModeEx;
    setFireModeEx: (fireModeEx: FireModeEx) => void;
    disabled: boolean;
    onChangeFireSelector: (weaponId: ItemId, fireSelector: FireSelector) => void;
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
    fireModeEx,
    setFireModeEx,
    disabled,
    onChangeFireSelector
}: FireModeComponentProps) {
    const { value: actionPoints } = unit.attributes.actionPoints;

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
                            disabled={disabled || !("single" in weapon.fireModes)}
                        >
                            <ImageComponent
                                images={[{ imageId: "fireSingle" }]}
                                width={40}
                                height={40}
                                disabled={disabled || !("single" in weapon.fireModes)}
                            />
                        </ToggleButton>
                        <ToggleButton
                            id="burst-fire"
                            title="Burst fire"
                            value={FireSelector.enum.burst}
                            disabled={disabled || !("burst" in weapon.fireModes)}
                        >
                            <ImageComponent
                                images={[{ imageId: "fireBurst" }]}
                                width={40}
                                height={40}
                                disabled={disabled || !("burst" in weapon.fireModes)}
                            />
                        </ToggleButton>
                        <ToggleButton
                            id="full-auto"
                            title="Full auto"
                            value={FireSelector.enum.auto}
                            disabled={disabled || !("auto" in weapon.fireModes)}
                        >
                            <ImageComponent
                                images={[{ imageId: "fireAuto" }]}
                                width={40}
                                height={40}
                                disabled={disabled || !("auto" in weapon.fireModes)}
                            />
                        </ToggleButton>
                    </ToggleButtonGroup>
                </>
            )}
            <StyledToggleButtonGroup
                orientation="vertical"
                value={fireModeEx}
                onChange={(_event, fireModeEx) => {
                    setFireModeEx(fireModeEx);
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
                                    title={FIRE_MODE_EX_LOOKUP[fireMode]}
                                    value={fireMode}
                                    disabled={disabled || actionPoints < actionPointCost}
                                >
                                    {FIRE_MODE_EX_LOOKUP[fireMode]}
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
                    <Stack key={fireModeEx} spacing={1}>
                        <ToggleButton
                            id={FireModeEx.enum.throw}
                            title={FIRE_MODE_EX_LOOKUP[FireModeEx.enum.throw]}
                            value={FireModeEx.enum.throw}
                            disabled={
                                disabled ||
                                actionPoints < unit.actions[Action.enum.throw].actionPoints
                            }
                        >
                            {FIRE_MODE_EX_LOOKUP[FireModeEx.enum.throw]}
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
