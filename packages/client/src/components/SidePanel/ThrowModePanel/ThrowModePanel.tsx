import { ItemSummary, UnitSummary } from "@atbs/shared-data";
import { Box, Button, Container, Grid, SxProps, Typography } from "@mui/material";
import { DescriptionComponent } from "../../Description/Description";
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
import { ImageComponent } from "../../Image";
import { Orientation } from "@atbs/maths";

export interface ThrowModePanelProps {
    visible: boolean;
    disabled: boolean;
    unit: UnitSummary | null;
    unitItem: ItemSummary | null;

    onRotateTo: (orientation: Orientation) => void;
    onEndThrowMode: () => void;

    sx?: SxProps;
}

export function ThrowModePanel({
    visible,
    disabled,
    unit,
    unitItem,
    onRotateTo,
    onEndThrowMode,
    sx
}: ThrowModePanelProps) {
    // const { imageCache } = useImageCache();

    if (!visible) {
        return null;
    }
    if (!unit || !unitItem) {
        return null;
    }

    return (
        <Container
            data-testid="throw-move-panel"
            disableGutters
            maxWidth={false}
            sx={{
                display: "grid",
                gridTemplateAreas: `
                    'unit-info'
                    'action-buttons'
                    'exit-button'
                `,
                gridTemplateRows: "1fr auto auto",
                rowGap: 1,
                p: 1,
                ...sx
            }}
        >
            <Grid
                sx={{
                    gridArea: "unit-info",
                    overflow: "auto",
                    display: "grid",
                    gridTemplateAreas: `
                        'name'
                        'image'
                        'description'
                        'direction-title'
                        'direction'
                        'attributes-title'
                        'attributes'
                        'next'
                    `,
                    gridTemplateRows: "auto auto auto auto auto autoauto 1fr",
                    rowGap: 2
                }}
            >
                <Typography variant="h5" sx={{ gridArea: "name", mx: "auto" }}>
                    {unit.name}
                </Typography>
                <ImageComponent sx={{ gridArea: "image", mx: "auto" }} images={unit.uiImage} />
                <Box sx={{ gridArea: "description" }}>
                    <DescriptionComponent description={unit.description} />
                </Box>
                <Typography variant="h6" sx={{ gridArea: "direction-title" }}>
                    Direction:
                </Typography>
                <DirectionComponent
                    direction={unit.orientation}
                    viewAngleInDegrees={unit.viewAngleInDegrees}
                    onDirectionChange={onRotateTo}
                    sx={{ gridArea: "direction", mx: "auto" }}
                />
                <Typography variant="h6" sx={{ gridArea: "attributes-title" }}>
                    Attributes:
                </Typography>
                <AttributesComponent
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
                    sx={{ gridArea: "attributes" }}
                />
            </Grid>
            {unitItem.name}
            <Button
                id="end-throw"
                title="End the current unit's throw mode"
                variant="outlined"
                disabled={disabled}
                onClick={onEndThrowMode}
                sx={{ gridArea: "exit-button" }}
            >
                End Throw Mode
            </Button>
        </Container>
    );
}
