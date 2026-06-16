import { UnitSummary } from "@atbs/shared-data";
import { Button, Container, Grid, SxProps } from "@mui/material";
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
import { useImageCache } from "../../../hooks/useImageCache";
import { UnitDetailsComponent } from "../../UnitDetails";
import { ItemDetailsComponent } from "../../ItemDetails";

export interface MoveModePanelProps {
    visible: boolean;
    disabled: boolean;
    unit: UnitSummary | null;

    onMove: (orientation: Orientation) => void;
    onRotateTo: (orientation: Orientation) => void;
    onEndMovement: () => void;
    onFireMode: () => void;
    onThrowMode: () => void;

    sx?: SxProps;
}

export function MoveModePanel({
    visible,
    disabled,
    unit,
    onMove,
    onRotateTo,
    onEndMovement,
    onFireMode,
    onThrowMode,
    sx
}: MoveModePanelProps) {
    const { imageCache } = useImageCache();

    const keyMap = useMemo(
        () => ({
            KeyA: () => unit && onRotateTo(rotateOrientation(unit.orientation, -1)),
            KeyD: () => unit && onRotateTo(rotateOrientation(unit.orientation, 1)),
            KeyW: () => unit && onMove(Orientation.NORTH),
            KeyS: () => unit && onMove(Orientation.SOUTH),
            // KeyF: () => onEnterFireMode(),
            // KeyI: () => onOpenInventory(),
            // KeyU: () => onActionMode(!actionMode),
            Escape: () => onEndMovement()
        }),
        [unit, onMove, onRotateTo, onEndMovement]
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
                        'unit'
                        'direction'
                        'attributes'
                        'item'
                        'action-buttons'
                    `,
                    gridTemplateRows: "auto auto auto 1fr",
                    rowGap: 2
                }}
            >
                <UnitDetailsComponent unit={unit} sx={{ gridArea: "unit" }} />
                <DirectionComponent
                    direction={unit.orientation}
                    viewAngleInDegrees={unit.viewAngleInDegrees}
                    onDirectionChange={onRotateTo}
                    sx={{ gridArea: "direction" }}
                />
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
                <ItemDetailsComponent
                    title="Item in Use"
                    item={unit.itemInUse}
                    sx={{ gridArea: "item" }}
                />
            </Grid>
            <Grid
                sx={{
                    gridArea: "action-buttons",
                    display: "grid",
                    gridTemplateAreas: `
                        'fire-mode throw-mode action-mode inventory'
                    `,
                    gridTemplateRows: "1fr",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr"
                }}
            >
                <Button
                    id="fire-mode"
                    title="Fire mode"
                    variant="outlined"
                    disabled={disabled || !unit.actions.canFire}
                    sx={{ gridArea: "fire-mode" }}
                    onClick={onFireMode}
                >
                    <img
                        src={imageCache.getDataSafe("fireMode")}
                        width={40}
                        height={40}
                        alt="Fire Mode"
                    />
                </Button>
                <Button
                    id="throw-mode"
                    title="Throw mode"
                    variant="outlined"
                    disabled={disabled || !unit.actions.canThrow}
                    sx={{ gridArea: "throw-mode" }}
                    onClick={onThrowMode}
                >
                    <img
                        src={imageCache.getDataSafe("throw")}
                        width={40}
                        height={40}
                        alt="Throw Mode"
                    />
                </Button>
                <Button
                    id="action-mode"
                    title="Action mode"
                    variant="outlined"
                    disabled={disabled || !unit.actions.canAction}
                    sx={{ gridArea: "action-mode" }}
                >
                    <img
                        src={imageCache.getDataSafe("action")}
                        width={40}
                        height={40}
                        alt="Action Mode"
                    />
                </Button>
                <Button
                    id="inventory"
                    title="Inventory"
                    variant="outlined"
                    disabled={disabled || !unit.actions.canInventory}
                    sx={{ gridArea: "inventory" }}
                >
                    <img
                        src={imageCache.getDataSafe("inventory")}
                        width={40}
                        height={40}
                        alt="Inventory"
                    />
                </Button>
            </Grid>
            <Button
                id="end-move"
                title="End the current unit's movement"
                variant="outlined"
                disabled={disabled}
                onClick={onEndMovement}
                sx={{ gridArea: "exit-button" }}
            >
                End Movement
            </Button>
        </Container>
    );
}
