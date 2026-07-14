import { UnitSummary } from "@atbs/shared-data";
import { Box, Button, Container, Grid, Stack, SxProps } from "@mui/material";
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
import { useMemo } from "react";
import { useKeyboard } from "../../../hooks";
import { UnitDetailsComponent } from "../../UnitDetails";
import { ItemDetailsComponent } from "../../ItemDetails";
import { ImageComponent } from "../../Image";
import { DisorientedComponent } from "../../Disoriented/Disoriented";
import { UnitsSeenComponent } from "../../UnitsSeen";

export interface UnitModePanelProps {
    visible: boolean;
    disabled: boolean;
    unit: UnitSummary | null;

    onMove: (orientation: Orientation) => void;
    onRotateTo: (orientation: Orientation) => void;
    onEndMovement: () => void;
    onFireMode: () => void;

    sx?: SxProps;
}

export function UnitModePanel({
    visible,
    disabled,
    unit,
    onMove,
    onRotateTo,
    onEndMovement,
    onFireMode,
    sx
}: UnitModePanelProps) {
    const keyMap = useMemo(
        () => ({
            KeyA: () => unit && onRotateTo(rotateOrientation(unit.orientation, -1)),
            KeyD: () => unit && onRotateTo(rotateOrientation(unit.orientation, 1)),
            KeyW: () => unit && onMove(Orientation.NORTH),
            KeyS: () => unit && onMove(Orientation.SOUTH),
            KeyF: () => onFireMode(),
            // KeyI: () => onOpenInventory(),
            // KeyU: () => onActionMode(!actionMode),
            Escape: () => onEndMovement()
        }),
        [unit, onMove, onRotateTo, onFireMode, onEndMovement]
    );

    useKeyboard({
        keyMap,
        disabled: !visible || disabled
    });

    if (!visible) {
        return null;
    }
    if (!unit) {
        return null;
    }

    return (
        <Container
            data-testid="move-mode-panel"
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
                <UnitDetailsComponent unit={unit} />
                <DirectionComponent
                    direction={unit.orientation}
                    viewAngleInDegrees={unit.viewAngleInDegrees}
                    onDirectionChange={onRotateTo}
                />
                <Box>
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
                <ItemDetailsComponent title="Item in Use" item={unit.itemInUse} />
            </Stack>
            <Stack spacing={1} sx={{ gridArea: "bottom-bar", px: 1, pb: 1 }}>
                <Grid
                    sx={{
                        display: "grid",
                        gridTemplateAreas: `
                            'fire-mode action-mode - inventory'
                        `,
                        gridTemplateRows: "1fr",
                        gridTemplateColumns: "1fr 1fr 1fr 1fr"
                    }}
                >
                    <Button
                        id="fire-mode"
                        title="Fire mode"
                        variant="outlined"
                        disabled={
                            disabled || (!unit.interactions.canFire && !unit.interactions.canThrow)
                        }
                        sx={{ gridArea: "fire-mode", aspectRatio: 1 }}
                        onClick={onFireMode}
                    >
                        <ImageComponent
                            images={[{ imageId: "fireMode" }]}
                            width={40}
                            height={40}
                            disabled={
                                disabled ||
                                (!unit.interactions.canFire && !unit.interactions.canThrow)
                            }
                        />
                    </Button>
                    <Button
                        id="action-mode"
                        title="Action mode"
                        variant="outlined"
                        disabled={disabled || !unit.interactions.canAction}
                        sx={{ gridArea: "action-mode", aspectRatio: 1 }}
                    >
                        <ImageComponent
                            images={[{ imageId: "action" }]}
                            width={40}
                            height={40}
                            disabled={disabled || !unit.interactions.canAction}
                        />
                    </Button>
                    {/* <Button
                        id="throw-mode"
                        title="Throw mode"
                        variant="outlined"
                        disabled={disabled || !unit.interactions.canThrow}
                        sx={{ gridArea: "throw-mode", aspectRatio: 1 }}
                        onClick={onThrowMode}
                    >
                        <img
                            src={imageCache.getDataSafe("throw")}
                            width={40}
                            height={40}
                            alt="Throw Mode"
                        />
                    </Button> */}
                    <Button
                        id="inventory"
                        title="Inventory"
                        variant="outlined"
                        disabled={disabled || !unit.interactions.canInventory}
                        sx={{ gridArea: "inventory", aspectRatio: 1 }}
                    >
                        <ImageComponent
                            images={[{ imageId: "inventory" }]}
                            width={40}
                            height={40}
                            disabled={disabled || !unit.interactions.canInventory}
                        />
                    </Button>
                </Grid>
                <Button
                    id="end-move"
                    title="End the current unit's movement"
                    variant="outlined"
                    disabled={disabled}
                    onClick={onEndMovement}
                >
                    End Movement
                </Button>
            </Stack>
        </Container>
    );
}
