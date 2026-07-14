import {
    FireModeEx,
    FireModeItemSummary,
    FireSelector,
    ItemId,
    OnTarget,
    UnitSummary
} from "@atbs/shared-data";
import { Box, Button, Container, Stack, SxProps } from "@mui/material";
import { AttributesComponent } from "../../Attributes";
import {
    CONSTITUTION_LEVELS,
    FITNESS_LEVELS,
    getAttributeString,
    getAttributeValue,
    MORALE_LEVELS,
    SPEED_LEVELS,
    STAMINA_LEVELS,
    STRENGTH_LEVELS
} from "../../../helpers/formattingHelpers";
import { DirectionComponent } from "../../Direction";
import { Orientation, rotateOrientation } from "@atbs/maths";
import { UnitDetailsComponent } from "../../UnitDetails";
import { FireModesComponent } from "../../FireModes";
import { useKeyboard, useWorld } from "../../../hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OnTargetComponent } from "../../OnTarget";
import { getModeHelper, isModeAvailable } from "../../../helpers/fireModeHelpers";
import { DisorientedComponent } from "../../Disoriented/Disoriented";
import { UnitsSeenComponent } from "../../UnitsSeen";

export interface FireModePanelProps {
    visible: boolean;
    disabled: boolean;
    unit: UnitSummary | null;
    unitWeapon: FireModeItemSummary | null;
    isOnTarget: OnTarget;

    onRotateTo: (orientation: Orientation) => void;
    onChangeFireSelector: (weaponId: ItemId, fireSelector: FireSelector) => void;
    onEndFireMode: () => void;

    sx?: SxProps;
}

export function FireModePanel({
    visible,
    disabled,
    unit,
    unitWeapon,
    isOnTarget,
    onRotateTo,
    onChangeFireSelector,
    onEndFireMode,
    sx
}: FireModePanelProps) {
    const initialWeaponIndex = 0;
    const [weaponIndex, setWeaponIndex] = useState(initialWeaponIndex);

    const weapon = unitWeapon?.weapons?.[weaponIndex] || null;

    const [fireModeEx, setFireModeEx] = useState<FireModeEx>(FireModeEx.enum.none);
    const { world } = useWorld();

    useEffect(() => {
        if (unit && weapon && !isModeAvailable(fireModeEx, unit, weapon)) {
            const newMode = getModeHelper(unit, weapon);
            setFireModeEx(newMode);
            world.fireModeEx = newMode;
        }
    }, [fireModeEx, unit, weapon, world]);

    const onSetFireModeEx = useCallback(
        (fireModeEx: FireModeEx) => {
            setFireModeEx(fireModeEx);
            world.fireModeEx = fireModeEx;
        },
        [world]
    );

    const keyMap = useMemo(
        () => ({
            KeyA: () => unit && onRotateTo(rotateOrientation(unit.orientation, -1)),
            KeyD: () => unit && onRotateTo(rotateOrientation(unit.orientation, 1)),

            KeyT: () => unit && onSetFireModeEx(FireModeEx.enum.throw),

            Digit1: () => unitWeapon && unitWeapon.weapons?.length > 0 && setWeaponIndex(0),
            Digit2: () => unitWeapon && unitWeapon.weapons?.length > 1 && setWeaponIndex(1),
            Digit3: () => unitWeapon && unitWeapon.weapons?.length > 2 && setWeaponIndex(2),

            Digit5: () =>
                unitWeapon &&
                FireSelector.enum.single in unitWeapon.weapons[weaponIndex].fireModes &&
                onChangeFireSelector(unitWeapon.id, FireSelector.enum.single),
            Digit6: () =>
                unitWeapon &&
                FireSelector.enum.burst in unitWeapon.weapons[weaponIndex].fireModes &&
                onChangeFireSelector(unitWeapon.id, FireSelector.enum.burst),
            Digit7: () =>
                unitWeapon &&
                FireSelector.enum.auto in unitWeapon.weapons[weaponIndex].fireModes &&
                onChangeFireSelector(unitWeapon.id, FireSelector.enum.auto),

            Digit9: () => unitWeapon && onSetFireModeEx(FireModeEx.enum.aimed),
            Digit0: () => unitWeapon && onSetFireModeEx(FireModeEx.enum.snapshot),

            Escape: () => onEndFireMode()
        }),
        [
            unit,
            onRotateTo,
            onEndFireMode,
            unitWeapon,
            weaponIndex,
            onChangeFireSelector,
            onSetFireModeEx,
            setWeaponIndex
        ]
    );

    useKeyboard({
        keyMap,
        disabled: !visible || disabled
    });

    if (!visible) {
        return null;
    }
    if (!unit || !unitWeapon) {
        return null;
    }

    return (
        <Container
            data-testid="fire-move-panel"
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
                <UnitDetailsComponent unit={unit} noDescription />
                <DirectionComponent
                    direction={unit.orientation}
                    viewAngleInDegrees={unit.viewAngleInDegrees}
                    onDirectionChange={onRotateTo}
                />
                <Box>
                    <OnTargetComponent isOnTarget={isOnTarget} />
                    <DisorientedComponent disorientation={unit.disorientation} />
                    <UnitsSeenComponent numSeenUnits={unit.canSee} sx={{ mb: 1 }} />
                    <AttributesComponent
                        title="Attributes"
                        attributes={[
                            {
                                id: "action-points",
                                label: "Action Points",
                                value: getAttributeValue(unit.attributes.actionPoints)
                            },
                            {
                                id: "constitution",
                                label: "Constitution",
                                text: getAttributeString(
                                    unit.attributes.constitution,
                                    CONSTITUTION_LEVELS
                                ),
                                value: getAttributeValue(unit.attributes.constitution)
                            },
                            {
                                id: "fitness",
                                label: "Fitness",
                                text: getAttributeString(
                                    unit.attributes.constitution,
                                    FITNESS_LEVELS
                                ),
                                value: getAttributeValue(unit.attributes.fitness)
                            },
                            {
                                id: "strength",
                                label: "Strength",
                                text: getAttributeString(unit.attributes.strength, STRENGTH_LEVELS),
                                value: getAttributeValue(unit.attributes.strength)
                            },
                            {
                                id: "speed",
                                label: "Speed",
                                text: getAttributeString(unit.attributes.speed, SPEED_LEVELS),
                                value: getAttributeValue(unit.attributes.speed)
                            },
                            {
                                id: "stamina",
                                label: "Stamina",
                                text: getAttributeString(unit.attributes.stamina, STAMINA_LEVELS),
                                value: getAttributeValue(unit.attributes.stamina)
                            },
                            {
                                id: "morale",
                                label: "Morale",
                                text: getAttributeString(unit.attributes.morale, MORALE_LEVELS),
                                value: getAttributeValue(unit.attributes.morale)
                            }
                        ]}
                        surround
                    />
                </Box>
                <FireModesComponent
                    unit={unit}
                    unitWeapon={unitWeapon}
                    weaponIndex={weaponIndex}
                    setWeaponIndex={setWeaponIndex}
                    fireModeEx={fireModeEx}
                    setFireModeEx={onSetFireModeEx}
                    disabled={disabled}
                    onChangeFireSelector={onChangeFireSelector}
                />
            </Stack>
            <Stack spacing={1} sx={{ gridArea: "bottom-bar", px: 1, pb: 1 }}>
                <Button
                    id="end-fire"
                    title="End the current unit's fire mode"
                    variant="outlined"
                    disabled={disabled}
                    onClick={onEndFireMode}
                    sx={{ gridArea: "exit-button" }}
                >
                    End Fire Mode
                </Button>
            </Stack>
        </Container>
    );
}
