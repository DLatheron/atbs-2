import {
    FireModeEx,
    UnitSummary,
    FireModeWeaponSummary,
    Action,
    FireModes,
    FireSelector,
    FireModeDetails,
    FireModeExtendedDetails,
    FireMode
} from "@atbs/shared-data";

/**
 * Check if the currently selected mode is available.
 */
export function isModeAvailable(
    mode: FireModeEx,
    unit: UnitSummary,
    weapon: FireModeWeaponSummary | null
): boolean {
    const { value: actionPoints } = unit.attributes.actionPoints;

    switch (mode) {
        case FireModeEx.enum.none:
            return false;

        case FireModeEx.enum.throw:
            return actionPoints >= unit.actions[Action.enum.throw].actionPoints;

        case FireModeEx.enum.aimed:
        case FireModeEx.enum.snapshot: {
            if (!weapon) {
                return false;
            }

            const fireModeDetails = getFireModeDetailsHelper(weapon.fireModes, weapon.fireSelector);

            return actionPoints >= fireModeDetails[mode].actionPoints;
        }
    }
}

export function getFireModeDetailsHelper(
    fireModes: FireModes,
    fireSelector: FireSelector
): FireModeDetails | FireModeExtendedDetails {
    if (fireSelector === FireSelector.enum.single && fireSelector in fireModes) {
        return fireModes[FireSelector.enum.single].fireModeDetails;
    } else if (fireSelector === FireSelector.enum.burst && fireSelector in fireModes) {
        return fireModes[FireSelector.enum.burst].fireModeDetails;
    } else if (fireSelector === FireSelector.enum.auto && fireSelector in fireModes) {
        return fireModes[FireSelector.enum.auto].fireModeDetails;
    }

    throw new Error(
        `Failed to get fire mode details for ${fireSelector} from ${JSON.stringify(fireModes)}`
    );
}

/**
 * Determine the base fire/throw mode.
 */
export function getModeHelper(unit: UnitSummary, weapon: FireModeWeaponSummary | null): FireModeEx {
    const { value: actionPoints } = unit.attributes.actionPoints;
    if (weapon) {
        const fireModeDetails = getFireModeDetailsHelper(weapon.fireModes, weapon.fireSelector);

        if (actionPoints >= fireModeDetails[FireMode.enum.aimed].actionPoints) {
            return FireModeEx.enum.aimed;
        } else if (actionPoints >= fireModeDetails[FireMode.enum.snapshot].actionPoints) {
            return FireModeEx.enum.snapshot;
        }
    } else if (actionPoints >= unit.actions[Action.enum.throw].actionPoints) {
        return FireModeEx.enum.throw;
    }

    return FireModeEx.enum.none;
}
