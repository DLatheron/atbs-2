import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography
} from "@mui/material";
import { useState } from "react";
import type { UnitSummary } from "@atbs/shared-data";
import { useArmamentPage } from "./useArmamentPage";
import { formatMoney, InventoryBoard } from "../../components/Inventory";
import {
    ACTION_BUTTON_BACKGROUND_COLOR,
    ARMAMENT_TITLE,
    BUDGET_TITLE,
    cutoutTextSx,
    MODAL_BACKGROUND_COLOR,
    MODAL_BACKGROUND_COLOR_TRANSPARENT
} from "../../components/Inventory/styles";
import { UnitDetailsComponent } from "../../components/UnitDetails";
import { AttributesComponent } from "../../components/Attributes";
import { ImageComponent } from "../../components/Image";
import {
    CONSTITUTION_LEVELS,
    FITNESS_LEVELS,
    formatWeight,
    getAttributeString,
    getAttributeValue,
    MORALE_LEVELS,
    SPEED_LEVELS,
    STAMINA_LEVELS,
    STRENGTH_LEVELS
} from "../../helpers/formattingHelpers";

const OVERSPENT_TEXT_COLOR = "#b71c1c";
const UNIT_SELECT_IMAGE_SIZE = 32;

function UnitSelectOption({ unit }: { unit: UnitSummary }) {
    return (
        <Stack direction="row" spacing={1} sx={{ minWidth: 0, py: 0.25, alignItems: "center" }}>
            <Box
                sx={{
                    width: UNIT_SELECT_IMAGE_SIZE,
                    height: UNIT_SELECT_IMAGE_SIZE,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden"
                }}
            >
                <ImageComponent
                    images={unit.uiImage}
                    width={UNIT_SELECT_IMAGE_SIZE}
                    height={UNIT_SELECT_IMAGE_SIZE}
                />
            </Box>
            <Typography component="span" noWrap>
                {unit.name}
            </Typography>
        </Stack>
    );
}

export interface ArmamentPageProps {
    visible: boolean;
}

export function ArmamentPage({ visible }: ArmamentPageProps) {
    const {
        units,
        selectedUnit,
        selectedUnitId,
        setSelectedUnitId,
        snapshot,
        store,
        onEndArmamentPhase,
        onUse,
        onUnuse,
        onLoad,
        onUnload,
        onReorder,
        onBuy,
        onSell,
        error
    } = useArmamentPage();
    const [pendingCost, setPendingCost] = useState<string | null>(null);

    // Only the arming side is sent a store; everyone else just waits.
    if (!visible || !store) {
        return null;
    }

    const budget = store.budget;
    const overspent = budget < 0;

    return (
        <Box
            data-testid="armament-page"
            sx={{
                display: "grid",
                gridTemplateColumns: "320px 1fr",
                gridTemplateRows: "auto 1fr auto",
                gridTemplateAreas: `
                    'header header'
                    'selector board'
                    'footer footer'
                `,
                height: "100vh",
                width: "100vw",
                overflow: "hidden",
                backgroundColor: MODAL_BACKGROUND_COLOR,
                p: 1,
                gap: 1,
                boxSizing: "border-box"
            }}
        >
            <Box
                data-testid="armament-header"
                sx={{
                    gridArea: "header",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
                    columnGap: 2,
                    alignItems: "center"
                }}
            >
                <Typography
                    variant="h4"
                    component="h2"
                    sx={{
                        fontWeight: "bold",
                        ...cutoutTextSx(MODAL_BACKGROUND_COLOR_TRANSPARENT)
                    }}
                >
                    {ARMAMENT_TITLE}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        m: "auto",
                        color: error ? OVERSPENT_TEXT_COLOR : pendingCost ? "#333" : "#666",
                        minHeight: "1.25em"
                    }}
                >
                    {error ?? pendingCost ?? ""}
                </Typography>
                <Typography
                    variant="h6"
                    component="span"
                    sx={{ ...cutoutTextSx(MODAL_BACKGROUND_COLOR_TRANSPARENT) }}
                >
                    {BUDGET_TITLE}
                </Typography>
                <Typography
                    id="armament-budget-value"
                    variant="h4"
                    component="span"
                    sx={{
                        textAlign: "right",
                        ...cutoutTextSx(
                            MODAL_BACKGROUND_COLOR_TRANSPARENT,
                            overspent ? OVERSPENT_TEXT_COLOR : undefined
                        )
                    }}
                >
                    {`${formatMoney(budget, store.currency)}`}
                </Typography>
            </Box>

            <Stack
                spacing={1}
                sx={{ gridArea: "selector", overflowY: "auto", minHeight: 0, pt: 1, pr: 0.5 }}
            >
                <FormControl size="small" fullWidth>
                    <InputLabel id="armament-unit-label">Unit</InputLabel>
                    <Select
                        labelId="armament-unit-label"
                        id="armament-unit-select"
                        label="Unit"
                        value={selectedUnitId ?? ""}
                        onChange={(event) => setSelectedUnitId(String(event.target.value))}
                        sx={{
                            backgroundColor: MODAL_BACKGROUND_COLOR,
                            "& .MuiSelect-select": {
                                display: "flex",
                                alignItems: "center",
                                py: 0.75
                            }
                        }}
                        renderValue={(unitId) => {
                            const unit = units.find((entry) => entry.id === unitId);
                            return unit ? <UnitSelectOption unit={unit} /> : null;
                        }}
                    >
                        {units.map((unit) => (
                            <MenuItem key={unit.id} value={unit.id}>
                                <UnitSelectOption unit={unit} />
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                {selectedUnit && (
                    <>
                        <UnitDetailsComponent unit={selectedUnit} />
                        <AttributesComponent
                            title="Attributes"
                            attributes={[
                                {
                                    id: "action-points",
                                    label: "Starting AP",
                                    value: getAttributeValue({
                                        max: selectedUnit.attributes.actionPoints.max,
                                        value: Math.max(
                                            0,
                                            selectedUnit.attributes.actionPoints.max -
                                                selectedUnit.burden
                                        )
                                    })
                                },
                                {
                                    id: "constitution",
                                    label: "Constitution",
                                    text: getAttributeString(
                                        selectedUnit.attributes.constitution,
                                        CONSTITUTION_LEVELS
                                    ),
                                    value: getAttributeValue(selectedUnit.attributes.constitution)
                                },
                                {
                                    id: "fitness",
                                    label: "Fitness",
                                    text: getAttributeString(
                                        selectedUnit.attributes.fitness,
                                        FITNESS_LEVELS
                                    ),
                                    value: getAttributeValue(selectedUnit.attributes.fitness)
                                },
                                {
                                    id: "strength",
                                    label: "Strength",
                                    text: getAttributeString(
                                        selectedUnit.attributes.strength,
                                        STRENGTH_LEVELS
                                    ),
                                    value: getAttributeValue(selectedUnit.attributes.strength)
                                },
                                {
                                    id: "speed",
                                    label: "Speed",
                                    text: getAttributeString(
                                        selectedUnit.attributes.speed,
                                        SPEED_LEVELS
                                    ),
                                    value: getAttributeValue(selectedUnit.attributes.speed)
                                },
                                {
                                    id: "stamina",
                                    label: "Stamina",
                                    text: getAttributeString(
                                        selectedUnit.attributes.stamina,
                                        STAMINA_LEVELS
                                    ),
                                    value: getAttributeValue(selectedUnit.attributes.stamina)
                                },
                                {
                                    id: "morale",
                                    label: "Morale",
                                    text: getAttributeString(
                                        selectedUnit.attributes.morale,
                                        MORALE_LEVELS
                                    ),
                                    value: getAttributeValue(selectedUnit.attributes.morale)
                                },
                                {
                                    id: "carried-weight",
                                    label: "Carried",
                                    value: formatWeight(selectedUnit.inventoryWeight)
                                },
                                {
                                    id: "burden",
                                    label: "Burden",
                                    value: selectedUnit.burden
                                }
                            ]}
                            surround
                        />
                    </>
                )}
            </Stack>

            <Box sx={{ gridArea: "board", minHeight: 0, minWidth: 0 }}>
                {snapshot ? (
                    <InventoryBoard
                        snapshot={snapshot}
                        store={store}
                        mode="shop"
                        actionScope="all"
                        inspectorFocus="selected"
                        onUse={onUse}
                        onUnuse={onUnuse}
                        onDrop={() => undefined}
                        onPickup={() => undefined}
                        onLoad={onLoad}
                        onUnload={onUnload}
                        onReorder={onReorder}
                        onBuy={onBuy}
                        onSell={onSell}
                        onPendingCostChange={setPendingCost}
                    />
                ) : (
                    <Typography sx={{ color: "#666", p: 2 }}>Waiting for armament data…</Typography>
                )}
            </Box>

            <Box
                sx={{
                    gridArea: "footer",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center"
                }}
            >
                <Button
                    id="end-armament"
                    title={
                        overspent
                            ? "Sell items until the budget is no longer overspent"
                            : "End Armament"
                    }
                    variant="contained"
                    disabled={overspent}
                    onClick={onEndArmamentPhase}
                    sx={{ textTransform: "none", px: 4 }}
                >
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: "bold",
                            ...cutoutTextSx(ACTION_BUTTON_BACKGROUND_COLOR)
                        }}
                    >
                        End Armament
                    </Typography>
                </Button>
            </Box>
        </Box>
    );
}
