import { FireModeItemSummary, FireSelector, ItemId, UnitSummary } from "@atbs/shared-data";
import { Button, Container, Stack, SxProps } from "@mui/material";
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
import { Orientation } from "@atbs/maths";
import { UnitDetailsComponent } from "../../UnitDetails";
import { FireModesComponent } from "../../FireModes";

export interface FireModePanelProps {
    visible: boolean;
    disabled: boolean;
    unit: UnitSummary | null;
    unitWeapon: FireModeItemSummary | null;

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
    onRotateTo,
    onChangeFireSelector,
    onEndFireMode,
    sx
}: FireModePanelProps) {
    // const { imageCache } = useImageCache();

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
                            text: getAttributeString(unit.attributes.constitution, FITNESS_LEVELS),
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
                <FireModesComponent
                    unit={unit}
                    unitWeapon={unitWeapon}
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
