import {
    FireModeItemSummary,
    FireModeWeaponSummary,
    FireSelector,
    ItemId,
    UnitSummary
} from "@atbs/shared-data";
import { Box, SxProps, Tab, Tabs, Typography } from "@mui/material";
import { useState } from "react";
import { FireModeComponent } from "./FireMode.tsx/FireMode";
import { useWorld } from "../../hooks";

export interface FireModesComponentProps {
    unit: UnitSummary;
    unitWeapon: FireModeItemSummary;

    onChangeFireSelector: (weaponId: ItemId, fireSelector: FireSelector) => void;

    sx?: SxProps;
}

export function FireModesComponent({
    unit,
    unitWeapon,
    onChangeFireSelector,
    sx
}: FireModesComponentProps) {
    const { world } = useWorld();
    const surroundProps = {
        borderRadius: 2,
        border: "1px black solid",
        backgroundColor: "beige",
        p: 0
    };

    const initialWeaponIndex = 0;
    const [weaponIndex, setWeaponIndex] = useState(initialWeaponIndex);

    return (
        <Box
            sx={{
                ...surroundProps,
                ...sx
            }}
        >
            {unitWeapon.weapons.length > 0 ? (
                <>
                    <Tabs
                        value={weaponIndex}
                        onChange={(_event, newValue) => {
                            setWeaponIndex(newValue);
                            world.unitWeaponIndex = newValue;
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
                                        unit={unit}
                                        unitWeapon={unitWeapon}
                                        weapon={weapon}
                                        onChangeFireSelector={onChangeFireSelector}
                                    />
                                )
                        )}
                    </Box>
                </>
            ) : (
                <Box sx={{ p: 1 }}>
                    <FireModeComponent
                        key={unitWeapon.id}
                        unit={unit}
                        unitWeapon={unitWeapon}
                        weapon={null}
                        onChangeFireSelector={onChangeFireSelector}
                    />
                </Box>
            )}
        </Box>
    );
}
