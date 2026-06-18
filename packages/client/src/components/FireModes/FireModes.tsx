import {
    FireModeItemSummary,
    FireModeWeaponSummary,
    FireSelector,
    ItemId
} from "@atbs/shared-data";
import { Box, SxProps, Tab, Tabs, Typography } from "@mui/material";
import { useState } from "react";
import { FireModeComponent } from "./FireMode.tsx/FireMode";

export interface FireModesComponentProps {
    actionPoints: number;
    unitWeapon: FireModeItemSummary;

    onChangeFireSelector: (weaponId: ItemId, fireSelector: FireSelector) => void;

    sx: SxProps;
}

export function FireModesComponent({
    actionPoints,
    unitWeapon,
    onChangeFireSelector,
    sx
}: FireModesComponentProps) {
    const surroundProps = {
        borderRadius: 2,
        border: "1px black solid",
        backgroundColor: "beige",
        p: 0
    };

    const initialWeaponIndex = 0;
    const [weaponIndex, setWeaponIndex] = useState(initialWeaponIndex);

    console.dir(unitWeapon);

    return (
        <Box
            sx={{
                ...surroundProps,
                ...sx
            }}
        >
            <Tabs
                value={weaponIndex}
                onChange={(_event, newValue) => {
                    // setFireSelector(getInitialFireSelector(unitWeapon.weapons[newValue]));
                    setWeaponIndex(newValue);
                }}
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
                {unitWeapon.weapons.map(
                    (weapon: FireModeWeaponSummary, index: number) =>
                        weaponIndex === index && (
                            <FireModeComponent
                                key={weapon.id}
                                actionPoints={actionPoints}
                                weapon={weapon}
                                onChangeFireSelector={onChangeFireSelector}
                            />
                        )
                )}
            </Box>
        </Box>
    );
}
