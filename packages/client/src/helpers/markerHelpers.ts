import { toTilePosString } from "@atbs/maths";
import {
    DeploymentZoneSummary,
    EditorMarkersState,
    MARKER_SIDE_IDS,
    MarkerSideId
} from "@atbs/shared-data";

export function findZoneAtTile(
    markersState: EditorMarkersState,
    tilePos: { col: number; row: number }
): { sideId: MarkerSideId; zoneId: string } | undefined {
    const key = toTilePosString(tilePos);

    for (const sideId of MARKER_SIDE_IDS) {
        for (const zone of markersState.sides[sideId].zones) {
            if (zone.tiles.some((tile) => toTilePosString(tile) === key)) {
                return { sideId, zoneId: zone.id };
            }
        }
    }

    return undefined;
}

export function markersStateToDeploymentSummary(
    markersState: EditorMarkersState,
    sideId: MarkerSideId
): DeploymentZoneSummary {
    const side = markersState.sides[sideId];

    return side.zones.map((zone) => ({
        name: zone.name,
        minUnits: zone.minUnits,
        maxUnits: zone.maxUnits,
        disabled: false,
        orientation: zone.orientation,
        deployedCount: 0,
        outlineColor:
            zone.minUnits !== undefined || zone.maxUnits !== undefined
                ? { r: 255, g: 176, b: 32, a: 255 }
                : undefined,
        tiles: new Set(zone.tiles.map((tile) => toTilePosString(tile))),
        allTiles: new Set(zone.tiles.map((tile) => toTilePosString(tile)))
    }));
}

export const ORIENTATION_OPTIONS = [
    { value: 0, label: "↑ North" },
    { value: 1, label: "↗ North-East" },
    { value: 2, label: "→ East" },
    { value: 3, label: "↘ South-East" },
    { value: 4, label: "↓ South" },
    { value: 5, label: "↙ South-West" },
    { value: 6, label: "← West" },
    { value: 7, label: "↖ North-West" }
] as const;
