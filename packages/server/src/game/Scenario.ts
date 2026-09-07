import { Description, ScenarioSummary, SideId, MapId, ScenarioId } from "@atbs/shared-data";
import z from "zod";
import { Side, SideRecipe, WidthHeight } from "./Side.js";
import { MapRecipeManager } from "./MapRecipeManager.js";
import { WorldMap } from "./WorldMap.js";
import type { Game } from "./Game.js";
import { ITilePos, toTilePosString, type TilePos } from "@atbs/maths";

export const ObjectiveZoneRecipe = z.object({
    id: z.string().nonempty().describe("Zone id referenced by victory rules (e.g. safe-1)."),
    name: z.string().nonempty().optional().describe("Display name for ${zone} tokens."),
    tiles: z
        .array(z.tuple([ITilePos, WidthHeight.optional().default({ width: 1, height: 1 })]))
        .describe("The tiles that the zone covers.")
});
export type ObjectiveZoneRecipe = z.infer<typeof ObjectiveZoneRecipe>;

export const ScenarioRecipe = z.object({
    id: ScenarioId,
    name: z.string().nonempty(),
    description: Description,
    worldMapId: MapId,
    objectiveZones: z.array(ObjectiveZoneRecipe).optional().default([]),
    sides: z.array(SideRecipe)
});
export type ScenarioRecipe = z.infer<typeof ScenarioRecipe>;

type ZoneRecord = {
    name: string;
    tiles: Set<string>;
};

export class Scenario {
    private readonly _recipe: Readonly<ScenarioRecipe>;
    private readonly _game: Game;

    private readonly _sides: Side[];
    private readonly _sidesMap: Map<SideId, Side>;
    private readonly _map: WorldMap;
    private readonly _zones: Map<string, ZoneRecord>;

    constructor(recipe: Readonly<ScenarioRecipe>, game: Game) {
        this._recipe = recipe;
        this._game = game;

        this._sides = recipe.sides.map((sideRecipe) => new Side(sideRecipe, this._game));
        this._sidesMap = new Map<SideId, Side>(this._sides.map((side) => [side.id, side]));

        const mapRecipe = MapRecipeManager.GetSingleton().get(recipe.worldMapId);
        this._map = new WorldMap(mapRecipe, this._game);

        this._zones = this._buildZones(recipe);

        for (const side of this._sides) {
            side.victoryPointManager.registerListeners(this._sidesMap);
        }
    }

    private _buildZones(recipe: Readonly<ScenarioRecipe>): Map<string, ZoneRecord> {
        const zones = new Map<string, ZoneRecord>();

        const addTiles = (zoneId: string, name: string, tileKeys: Iterable<string>) => {
            let record = zones.get(zoneId);
            if (!record) {
                record = { name, tiles: new Set<string>() };
                zones.set(zoneId, record);
            } else if (name && record.name === zoneId) {
                record.name = name;
            }
            for (const key of tileKeys) {
                record.tiles.add(key);
            }
        };

        for (const zone of recipe.objectiveZones ?? []) {
            addTiles(zone.id, zone.name ?? zone.id, expandZoneTiles(zone.tiles));
        }

        for (const side of this._sides) {
            const marker = side.findDeploymentMarker();
            if (!marker) {
                continue;
            }
            addTiles(marker, marker, side.getAllDeploymentTileKeys());
        }

        return zones;
    }

    get id() {
        return this._recipe.id;
    }

    get name() {
        return this._recipe.name;
    }

    get description() {
        return this._recipe.description;
    }

    get sides(): Side[] {
        return this._sides;
    }

    get needsArmamentPhase() {
        return this.sides.some((side) => side.needsArmamentPhase);
    }

    get needsDeploymentPhase() {
        return this.sides.some((side) => side.participatesInDeploymentPhase);
    }

    get map(): WorldMap {
        return this._map;
    }

    hasSide(sideId: SideId) {
        return !!this.findSide(sideId);
    }

    findSide(sideId: SideId) {
        return this._sidesMap.get(sideId);
    }

    getSide(sideId: SideId): Side {
        const side = this.findSide(sideId);
        if (!side) {
            throw new Error(`Side ${sideId} not found`);
        }
        return side;
    }

    getZoneIdsAt(location: TilePos): string[] {
        const key = toTilePosString(location);
        const ids: string[] = [];
        for (const [zoneId, zone] of this._zones) {
            if (zone.tiles.has(key)) {
                ids.push(zoneId);
            }
        }
        return ids;
    }

    isTileInZone(location: TilePos, zoneId: string): boolean {
        return this._zones.get(zoneId)?.tiles.has(toTilePosString(location)) ?? false;
    }

    getZoneName(zoneId: string): string {
        return this._zones.get(zoneId)?.name ?? zoneId;
    }

    toScenarioSummary(): ScenarioSummary {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            sides: this._sides.map((side) => ({
                id: side.id,
                name: side.name,
                description: side.description
            }))
        };
    }
}

function expandZoneTiles(tiles: Array<[ITilePos, { width: number; height: number }?]>): string[] {
    const keys: string[] = [];
    for (const [origin, size] of tiles) {
        const width = size?.width ?? 1;
        const height = size?.height ?? 1;
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                keys.push(toTilePosString({ col: origin.col + col, row: origin.row + row }));
            }
        }
    }
    return keys;
}
