import { FireModeItemSummary, FireModeWeaponSummary } from "@atbs/shared-data";
import { Box, SxProps, Tab, Tabs, Typography } from "@mui/material";
import { AttributesComponent } from "../Attributes";
import { useState } from "react";

export interface FireModesComponentProps {
    unitWeapon: FireModeItemSummary;
    sx: SxProps;
}

export function FireModesComponent({ unitWeapon, sx }: FireModesComponentProps) {
    const [tabIndex, setTabIndex] = useState(0);

    return (
        <Box sx={sx}>
            <Tabs onChange={(_event, newValue) => setTabIndex(newValue)} variant="fullWidth">
                {unitWeapon.weapons.map((weapon: FireModeWeaponSummary) => (
                    <Tab label={<Typography variant="h6">{weapon.shortName}</Typography>} />
                ))}
            </Tabs>
            {unitWeapon.weapons.map(
                (weapon: FireModeWeaponSummary, index: number) =>
                    tabIndex === index && (
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
                                gridTemplateRows: "auto auto auto auto auto"
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
                        </Box>
                    )
            )}
        </Box>
    );
}
