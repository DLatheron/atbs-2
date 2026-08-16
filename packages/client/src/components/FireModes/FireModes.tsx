import {
    FireModeEx,
    FireModeItemSummary,
    FireModeWeaponSummary,
    FireSelector,
    ItemId,
    Prime,
    UnitSummary
} from "@atbs/shared-data";
import { Box, SxProps, Tab, Tabs, Typography } from "@mui/material";
import { FireModeComponent } from "./FireMode.tsx/FireMode";

export interface FireModesComponentProps {
    unit: UnitSummary;
    unitWeapon: FireModeItemSummary;
    weaponIndex: number;
    fireModeEx: FireModeEx;
    setFireModeEx: (fireModeEx: FireModeEx | null) => void;
    disabled: boolean;

    onPrime: (prime: Prime) => void;
    onChangeFireSelector: (weaponId: ItemId, fireSelector: FireSelector) => void;
    onChangeWeaponIndex: (weaponIndex: number) => void;

    sx?: SxProps;
}

export function FireModesComponent({
    unit,
    unitWeapon,
    weaponIndex,
    fireModeEx,
    setFireModeEx,
    disabled,
    onPrime,
    onChangeFireSelector,
    onChangeWeaponIndex,
    sx
}: FireModesComponentProps) {
    const surroundProps = {
        borderRadius: 2,
        border: "1px black solid",
        backgroundColor: "beige",
        p: 0
    };

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
                            onChangeWeaponIndex(newValue);
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
                                        fireModeEx={fireModeEx}
                                        setFireModeEx={setFireModeEx}
                                        disabled={disabled}
                                        onPrime={onPrime}
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
                        fireModeEx={fireModeEx}
                        setFireModeEx={setFireModeEx}
                        disabled={disabled}
                        onPrime={onPrime}
                        onChangeFireSelector={onChangeFireSelector}
                    />
                </Box>
            )}
        </Box>
    );
}
