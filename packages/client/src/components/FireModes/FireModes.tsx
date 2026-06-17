import { FireModeItemSummary, FireModeWeaponSummary, FireSelector } from "@atbs/shared-data";
import {
    Box,
    SxProps,
    Tab,
    Tabs,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import { AttributesComponent } from "../Attributes";
import { useState } from "react";
import { ImageComponent } from "../Image";

export interface FireModesComponentProps {
    unitWeapon: FireModeItemSummary;
    sx: SxProps;
}

export function FireModesComponent({ unitWeapon, sx }: FireModesComponentProps) {
    const surroundProps = {
        borderRadius: 2,
        border: "1px black solid",
        backgroundColor: "beige",
        p: 0
    };

    const [weaponIndex, setWeaponIndex] = useState(0);
    const [fireSelector, setFireSelector] = useState<FireSelector | undefined>();

    return (
        <Box
            sx={{
                ...surroundProps,
                ...sx
            }}
        >
            <Tabs
                value={weaponIndex}
                onChange={(_event, newValue) => setWeaponIndex(newValue)}
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
                    if (weaponIndex !== index) {
                        return null;
                    }

                    console.info({ fm: weapon.fireModes });

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
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
