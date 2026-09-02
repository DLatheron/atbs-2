import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fromTilePosString, ITilePos, Orientation, TilePos, toTilePosString } from "@atbs/maths";
import {
    EditorDeploymentZoneWire,
    EditorMarkersState,
    MARKER_SIDE_IDS,
    MarkerSideId,
    tilesToMinimalRectangles
} from "@atbs/shared-data";

const ZONE_NAME_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const ZONE_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

const EDITOR_SAVES_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../data/editor-saves"
);

interface EditorZone {
    id: string;
    name: string;
    minUnits?: number;
    maxUnits?: number;
    orientation: Orientation;
    tileKeys: Set<string>;
    isDrawing: boolean;
}

interface MarkerSideState {
    zones: EditorZone[];
}

function randomZoneName(): string {
    let suffix = "";
    for (let i = 0; i < 4; i++) {
        suffix += ZONE_NAME_CHARS[randomInt(ZONE_NAME_CHARS.length)];
    }
    return `Zone ${suffix}`;
}

function randomZoneId(): string {
    let id = "";
    for (let i = 0; i < 8; i++) {
        id += ZONE_ID_CHARS[randomInt(ZONE_ID_CHARS.length)];
    }
    return id;
}

function cloneState(state: EditorMarkersState): EditorMarkersState {
    return structuredClone(state);
}

function tileKeysToWireTiles(tileKeys: Iterable<string>): ITilePos[] {
    return [...tileKeys].map((key) => fromTilePosString(key));
}

function zoneToWire(zone: EditorZone): EditorDeploymentZoneWire {
    const tiles = tileKeysToWireTiles(zone.tileKeys);
    const rectangles = tilesToMinimalRectangles(tiles);

    return {
        id: zone.id,
        name: zone.name,
        ...(zone.minUnits !== undefined ? { minUnits: zone.minUnits } : {}),
        ...(zone.maxUnits !== undefined ? { maxUnits: zone.maxUnits } : {}),
        orientation: zone.orientation,
        tiles,
        isDrawing: zone.isDrawing,
        rectangles
    };
}

export class EditorMarkers {
    private _selectedSideId: MarkerSideId = MARKER_SIDE_IDS[0];
    private _selectedZoneId: string | null = null;
    private readonly _sides: Record<MarkerSideId, MarkerSideState>;

    constructor() {
        this._sides = {
            "deploy-1": { zones: [] },
            "deploy-2": { zones: [] },
            "safe-1": { zones: [] },
            "safe-2": { zones: [] }
        };
    }

    reset() {
        this._selectedSideId = MARKER_SIDE_IDS[0];
        this._selectedZoneId = null;
        for (const sideId of MARKER_SIDE_IDS) {
            this._sides[sideId].zones = [];
        }
    }

    getState(): EditorMarkersState {
        return {
            selectedSideId: this._selectedSideId,
            selectedZoneId: this._selectedZoneId,
            sides: {
                "deploy-1": { zones: this._sides["deploy-1"].zones.map(zoneToWire) },
                "deploy-2": { zones: this._sides["deploy-2"].zones.map(zoneToWire) },
                "safe-1": { zones: this._sides["safe-1"].zones.map(zoneToWire) },
                "safe-2": { zones: this._sides["safe-2"].zones.map(zoneToWire) }
            }
        };
    }

    restoreState(state: EditorMarkersState) {
        this._selectedSideId = state.selectedSideId;
        this._selectedZoneId = state.selectedZoneId;

        for (const sideId of MARKER_SIDE_IDS) {
            this._sides[sideId].zones = state.sides[sideId].zones.map((zone) => ({
                id: zone.id,
                name: zone.name,
                minUnits: zone.minUnits,
                maxUnits: zone.maxUnits,
                orientation: zone.orientation,
                tileKeys: new Set(zone.tiles.map((tile) => toTilePosString(tile))),
                isDrawing: zone.isDrawing
            }));
        }
    }

    selectSide(sideId: MarkerSideId) {
        this._selectedSideId = sideId;
        this._selectedZoneId = null;
    }

    selectZone(zoneId: string | null) {
        if (zoneId === null) {
            this._selectedZoneId = null;
            return;
        }

        const zone = this._findZone(zoneId);
        if (!zone) {
            return;
        }

        this._selectedSideId = zone.sideId;
        this._selectedZoneId = zoneId;
    }

    selectZoneAt(tilePos: ITilePos): boolean {
        const owner = this._findTileOwner(tilePos);
        if (!owner) {
            return false;
        }

        this._selectedSideId = owner.sideId;
        this._selectedZoneId = owner.zoneId;
        return true;
    }

    newZone(): string {
        const zone: EditorZone = {
            id: randomZoneId(),
            name: randomZoneName(),
            orientation: Orientation.NORTH,
            tileKeys: new Set(),
            isDrawing: true
        };

        this._sides[this._selectedSideId].zones.push(zone);
        this._selectedZoneId = zone.id;
        return zone.id;
    }

    doneZone(): boolean {
        const zone = this._getSelectedZone();
        if (!zone || !zone.isDrawing) {
            return false;
        }

        zone.isDrawing = false;
        return true;
    }

    updateZone(params: {
        zoneId: string;
        name?: string;
        minUnits?: number | null;
        maxUnits?: number | null;
        orientation?: Orientation;
    }): boolean {
        const found = this._findZone(params.zoneId);
        if (!found) {
            return false;
        }

        const { zone } = found;

        if (params.name !== undefined) {
            zone.name = params.name;
        }
        if (params.minUnits !== undefined) {
            zone.minUnits = params.minUnits ?? undefined;
        }
        if (params.maxUnits !== undefined) {
            zone.maxUnits = params.maxUnits ?? undefined;
        }
        if (params.orientation !== undefined) {
            zone.orientation = params.orientation;
        }

        this._selectedSideId = found.sideId;
        this._selectedZoneId = params.zoneId;
        return true;
    }

    deleteZone(zoneId: string): boolean {
        for (const sideId of MARKER_SIDE_IDS) {
            const index = this._sides[sideId].zones.findIndex((zone) => zone.id === zoneId);
            if (index >= 0) {
                this._sides[sideId].zones.splice(index, 1);
                if (this._selectedZoneId === zoneId) {
                    this._selectedZoneId = null;
                }
                return true;
            }
        }

        return false;
    }

    addTile(tilePos: ITilePos, mapWidth: number, mapHeight: number): boolean {
        const tilePosObj = new TilePos(tilePos);
        if (
            tilePosObj.col < 0 ||
            tilePosObj.row < 0 ||
            tilePosObj.col >= mapWidth ||
            tilePosObj.row >= mapHeight
        ) {
            return false;
        }

        const zone = this._getSelectedZone();
        if (!zone) {
            return false;
        }

        const key = toTilePosString(tilePos);
        if (zone.tileKeys.has(key)) {
            return false;
        }

        if (this._findTileOwner(tilePos)) {
            return false;
        }

        zone.tileKeys.add(key);
        return true;
    }

    removeTile(tilePos: ITilePos): boolean {
        const zone = this._getSelectedZone();
        if (!zone) {
            return false;
        }

        const key = toTilePosString(tilePos);
        if (!zone.tileKeys.has(key)) {
            return false;
        }

        zone.tileKeys.delete(key);
        return true;
    }

    async saveScenario(mapId: string, mapName: string): Promise<{ filename: string }> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `${mapId}-markers-${timestamp}.scenario.json`;
        const fullPath = path.join(EDITOR_SAVES_DIR, filename);

        const scenario = {
            id: `${mapId}.markers.scenario`,
            name: `Deployment markers for ${mapName}`,
            description: [{ text: "Generated by the map editor markers tab." }],
            worldMapId: mapId,
            sides: MARKER_SIDE_IDS.map((sideId) => {
                const zones = this._sides[sideId].zones
                    .filter((zone) => zone.tileKeys.size > 0)
                    .map((zone) => {
                        const tiles = tileKeysToWireTiles(zone.tileKeys);
                        const rectangles = tilesToMinimalRectangles(tiles);

                        return {
                            name: zone.name,
                            ...(zone.minUnits !== undefined ? { minUnits: zone.minUnits } : {}),
                            ...(zone.maxUnits !== undefined ? { maxUnits: zone.maxUnits } : {}),
                            ...(zone.minUnits !== undefined || zone.maxUnits !== undefined
                                ? { outlineColor: "#ffb020" }
                                : {}),
                            tiles: rectangles.map(({ col, row, width, height }) => [
                                { col, row },
                                ...(width > 1 || height > 1 ? [{ width, height }] : [])
                            ]),
                            orientation: zone.orientation
                        };
                    });

                return {
                    id: `markers-${sideId}`,
                    name: sideId,
                    description: [{ text: "" }],
                    oppositionSideIds: [],
                    units: [],
                    phases: {
                        armament: { type: "fixed" },
                        deployment:
                            zones.length > 0
                                ? {
                                      type: "manual",
                                      marker: sideId,
                                      zones
                                  }
                                : { type: "fixed" }
                    }
                };
            })
        };

        await mkdir(EDITOR_SAVES_DIR, { recursive: true });
        await writeFile(fullPath, `${JSON.stringify(scenario, null, 4)}\n`, "utf-8");

        return { filename };
    }

    createSnapshot(): EditorMarkersState {
        return cloneState(this.getState());
    }

    private _getSelectedZone(): EditorZone | undefined {
        if (!this._selectedZoneId) {
            return undefined;
        }

        return this._findZone(this._selectedZoneId)?.zone;
    }

    private _findZone(zoneId: string): { sideId: MarkerSideId; zone: EditorZone } | undefined {
        for (const sideId of MARKER_SIDE_IDS) {
            const zone = this._sides[sideId].zones.find((entry) => entry.id === zoneId);
            if (zone) {
                return { sideId, zone };
            }
        }

        return undefined;
    }

    private _findTileOwner(tilePos: ITilePos): { sideId: MarkerSideId; zoneId: string } | undefined {
        const key = toTilePosString(tilePos);

        for (const sideId of MARKER_SIDE_IDS) {
            for (const zone of this._sides[sideId].zones) {
                if (zone.tileKeys.has(key)) {
                    return { sideId, zoneId: zone.id };
                }
            }
        }

        return undefined;
    }

    clipToMapBounds(width: number, height: number) {
        for (const sideId of MARKER_SIDE_IDS) {
            for (const zone of this._sides[sideId].zones) {
                for (const key of [...zone.tileKeys]) {
                    const tilePos = fromTilePosString(key);
                    if (tilePos.col < 0 || tilePos.col >= width || tilePos.row < 0 || tilePos.row >= height) {
                        zone.tileKeys.delete(key);
                    }
                }
            }
        }

        if (this._selectedZoneId) {
            const selectedZone = this._findZone(this._selectedZoneId);
            if (!selectedZone) {
                this._selectedZoneId = null;
            }
        }
    }
}

export function cloneMarkersState(state: EditorMarkersState): EditorMarkersState {
    return cloneState(state);
}
