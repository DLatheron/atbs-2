import { UnitSummary } from "@atbs/shared-data";
import { Box, Button, Container, Grid, Stack, SxProps, Typography } from "@mui/material";
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

export interface MoveModePanelProps {
    visible: boolean;
    disabled: boolean;
    unit: UnitSummary | null;

    onEndTurn: () => void;

    sx?: SxProps;
}

export function MoveModePanel({ visible, disabled, unit, onEndTurn, sx }: MoveModePanelProps) {
    if (!visible) {
        return null;
    }
    if (!unit) {
        return null;
    }

    return (
        <Container
            data-testid="move-move-panel"
            disableGutters
            maxWidth={false}
            sx={{
                display: "grid",
                gridTemplateAreas: `
                'unitInfo'
                'exit-button'
                `,
                gridTemplateRows: "1fr auto",
                rowGap: 0,
                p: 1,
                ...sx
            }}
        >
            <Grid
                sx={{
                    gridArea: "unitInfo",
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
                <Typography variant="h5" sx={{ gridArea: "name", mx: "auto" }}>{unit.name}</Typography>
                <ImageComponent sx={{ gridArea: "image", mx: "auto" }} images={unit.uiImage} />
                <Box sx={{ gridArea: "description" }}>
                    <DescriptionComponent description={unit.description} />
                </Box>
                <Typography variant="h6" sx={{ gridArea: "direction-title"}}>Direction:</Typography>
                <DirectionComponent
                    direction={unit.orientation}
                    viewAngleInDegrees={unit.viewAngleInDegrees}
                    onDirectionChange={() => {}}
                    sx={{ gridArea: "direction", mx: "auto" }}
                />
                <Typography variant="h6" sx={{ gridArea: "attributes-title"}}>Attributes:</Typography>
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
            <Button
                id="end-move"
                title="End the current unit's movement"
                variant="outlined"
                disabled={disabled}
                onClick={onEndTurn}
                sx={{ gridArea: "exit-button" }}
            >
                End Movement
            </Button>
        </Container>
    );
}
