import {
    DeploymentZoneSummaryWire,
    Description,
    RenderList,
    SideId,
    SideSummary,
    UnitId
} from "@atbs/shared-data";
import z from "zod";
import { Unit, UnitOverrides } from "./Unit.js";
import { UnitRecipeManager } from "./UnitRecipeManager.js";
import type { Game } from "./Game.js";
import { InventoryRecipe } from "./Inventory.js";
import { Store, StoreRecipe } from "./Store.js";
import {
    fromTilePosString,
    ITilePos,
    IColour,
    Orientation,
    TilePos,
    toTilePosString
} from "@atbs/maths";
import { ShuffleArray } from "../../../maths/src/Misc.js";
import { VisibilityPoi } from "./VisibilityPoi.js";

export const WidthHeight = z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
});
export type WidthHeight = z.infer<typeof WidthHeight>;

export const SideRecipe = z.object({
    id: SideId,
    name: z.string().nonempty(),
    description: Description,
    oppositionSideIds: z.array(SideId),
    units: z.array(
        z.object({
            id: UnitId,
            overrides: UnitOverrides
        })
    ),
    phases: z.object({
        armament: z.discriminatedUnion("type", [
            z.object({
                type: z.literal("fixed").describe("The type of armament phase.")
            }),
            z.object({
                type: z.literal("manual").describe("The type of deployment phase."),
                store: StoreRecipe,
                startingInventory: z
                    .record(UnitId, InventoryRecipe)
                    .optional()
                    .describe("The starting inventory for each unit.")
            })
        ]),
        deployment: z.discriminatedUnion("type", [
            z.object({
                type: z.literal("fixed").describe("The type of deployment phase.")
            }),
            z
                .object({
                    type: z.literal("manual").describe("The type of deployment phase."),
                    marker: z
                        .string()
                        .nonempty()
                        .describe("The marker that will be used to deploy the side."),
                    zones: z.array(
                        z
                            .object({
                                minUnits: z
                                    .number()
                                    .int()
                                    .nonnegative()
                                    .optional()
                                    .describe(
                                        "The minimum number of units that can be deployed to the zone."
                                    ),
                                maxUnits: z
                                    .number()
                                    .int()
                                    .nonnegative()
                                    .optional()
                                    .describe(
                                        "The maximum number of units that can be deployed to the zone."
                                    ),
                                tiles: z
                                    .array(
                                        z.tuple([
                                            ITilePos,
                                            WidthHeight.optional().default({ width: 1, height: 1 })
                                        ])
                                    )
                                    .describe("The tiles that the zone covers."),
                                orientation: z
                                    .enum(Orientation)
                                    .describe("The orientation of the zone."),
                                outlineColor: z
                                    .union([
                                        IColour,
                                        z
                                            .string()
                                            .regex(/^#[0-9A-Fa-f]{6}$/)
                                            .describe("Hex colour, e.g. #ffb020")
                                    ])
                                    .optional()
                                    .describe(
                                        "Outline colour for zones with minUnits or maxUnits constraints"
                                    )
                            })
                            .describe("A zone that the side can deploy to.")
                    )
                })
                .describe("A zone that the side can deploy to.")
        ])
    })
});
export type SideRecipe = z.infer<typeof SideRecipe>;

interface DeploymentZone {
    id: string;
    minUnits: number | undefined;
    maxUnits: number | undefined;
    orientation: Orientation;
    outlineColor: IColour | undefined;
    allTiles: Set<string>;
    tiles: Set<string>;
    units: Set<UnitId>;
}

function normalizeOutlineColor(color: IColour | string): IColour {
    if (typeof color === "string") {
        const hex = color.slice(1);
        return {
            r: Number.parseInt(hex.slice(0, 2), 16),
            g: Number.parseInt(hex.slice(2, 4), 16),
            b: Number.parseInt(hex.slice(4, 6), 16),
            a: 1
        };
    }

    return color;
}

const DEFAULT_CONSTRAINT_OUTLINE_COLOR: IColour = { r: 255, g: 176, b: 32, a: 1 };

function zoneOutlineColor(zone: DeploymentZone): IColour | undefined {
    if (zone.minUnits == null && zone.maxUnits == null) {
        return undefined;
    }

    return zone.outlineColor ?? DEFAULT_CONSTRAINT_OUTLINE_COLOR;
}

export class Side {
    private readonly _recipe: Readonly<SideRecipe>;
    private readonly _game: Game;
    private readonly _units: Unit[];
    private readonly _unitMap: Map<UnitId, Unit>;
    private _victoryPoints: number;
    private readonly _store: Store | null;

    private _deployableUnitsMap: Map<UnitId, { zone: DeploymentZone; location: TilePos } | null>;
    private _deploymentZones: DeploymentZone[];

    constructor(recipe: Readonly<SideRecipe>, game: Game) {
        this._recipe = recipe;
        this._game = game;
        this._victoryPoints = 0;

        this._units = [];
        this._unitMap = new Map<UnitId, Unit>();

        this._recipe.units.forEach(({ id, overrides }) => {
            const unit = UnitRecipeManager.GetSingleton().newUnit(
                id,
                overrides,
                { side: this },
                this._game
            );

            this._units.push(unit);
            this._unitMap.set(unit.id, unit);
        });

        const { armament } = this._recipe.phases;
        if (armament.type === "manual") {
            this._store = new Store(armament.store, game.itemManager);
            for (const unit of this._units) {
                const starting = armament.startingInventory?.[unit.id];
                unit.resetInventory(starting ?? { inUse: null, items: [] });
            }
        } else {
            this._store = null;
        }

        this._deployableUnitsMap = new Map<
            UnitId,
            { zone: DeploymentZone; location: TilePos } | null
        >();
        for (const unit of this._units) {
            this._deployableUnitsMap.set(unit.id, null);
        }
        this._deploymentZones = this._buildDeploymentZones() ?? [];
    }

    get id(): SideId {
        return this._recipe.id;
    }

    get name(): string {
        return this._recipe.name;
    }

    get description(): Description {
        return this._recipe.description;
    }

    get oppositionSideIds(): SideId[] {
        return this._recipe.oppositionSideIds;
    }

    get victoryPoints(): number {
        return this._victoryPoints;
    }

    get needsArmamentPhase(): boolean {
        return this._recipe.phases.armament.type === "manual";
    }

    get store(): Store {
        if (!this._store) {
            throw new Error(`Side ${this.id} does not have a store`);
        }
        return this._store;
    }

    findStore(): Store | null {
        return this._store;
    }

    get needsDeploymentPhase(): boolean {
        return this._recipe.phases.deployment.type === "manual";
    }

    get units(): Unit[] {
        return this._units;
    }

    get hasAliveUnits(): boolean {
        return this._units.some((unit) => unit.isAlive);
    }

    get allUnitsDead(): boolean {
        return this._units.every((unit) => unit.isDead);
    }

    get deploymentMarker(): string {
        if (this._recipe.phases.deployment.type === "fixed") {
            throw new Error(`Side ${this.id} has no deployment marker`);
        }
        return this._recipe.phases.deployment.marker;
    }

    canSee(poi: VisibilityPoi): boolean {
        return this._game.visibilityManager.isPoiVisibleForMasks(poi, [this.id]);
    }

    findUnit(unitId: UnitId): Unit | undefined {
        return this._unitMap.get(unitId);
    }

    getUnit(unitId: UnitId): Unit {
        const unit = this.findUnit(unitId);
        if (!unit) {
            throw new Error(`Unit ${unitId} not found`);
        }
        return unit;
    }

    toSummary(): SideSummary {
        return {
            id: this.id,
            name: this.name,
            victoryPoints: this.victoryPoints
        };
    }

    private _buildDeploymentZones(): DeploymentZone[] | undefined {
        if (this._recipe.phases.deployment.type === "fixed") {
            return;
        }

        const deploymentZones: DeploymentZone[] = [];

        for (const zone of this._recipe.phases.deployment.zones) {
            const calculatedZone: DeploymentZone = {
                id: `zone-${deploymentZones.length}`,
                minUnits: zone.minUnits,
                maxUnits: zone.maxUnits,
                tiles: new Set<string>(),
                allTiles: new Set<string>(),
                units: new Set<UnitId>(),
                orientation: zone.orientation,
                outlineColor:
                    zone.outlineColor != null ? normalizeOutlineColor(zone.outlineColor) : undefined
            };

            for (const [pos, size] of zone.tiles) {
                for (let col = pos.col; col < pos.col + size.width; col++) {
                    for (let row = pos.row; row < pos.row + size.height; row++) {
                        const tileString = toTilePosString({ col, row });
                        calculatedZone.tiles.add(tileString);
                        calculatedZone.allTiles.add(tileString);
                    }
                }
            }

            deploymentZones.push(calculatedZone);
        }

        // Need to put them into

        // We now have a list of all the tiles that we can use for deployment.
        return deploymentZones;
    }

    getDeploymentZone(location: ITilePos): DeploymentZone | undefined {
        return this._deploymentZones?.find((zone) => zone.tiles.has(toTilePosString(location)));
    }

    getDeploymentMarker(tilePos: ITilePos): string | undefined {
        if (this._recipe.phases.deployment.type === "fixed") {
            return;
        }

        for (const zone of this._deploymentZones) {
            if (zone.tiles.has(toTilePosString(tilePos))) {
                return this.deploymentMarker;
            }
        }

        return;
    }

    deployUnit(unitId: UnitId, location: TilePos): void {
        const unit = this.getUnit(unitId);
        if (unit.location) {
            throw new Error(`Unit ${unitId} is already deployed at ${unit.location}`);
        }

        const deploymentZone = this.getDeploymentZone(location);
        if (!deploymentZone) {
            throw new Error(`Location ${location} is not a valid deployment zone`);
        }

        if (deploymentZone.maxUnits && deploymentZone.maxUnits <= deploymentZone.units.size) {
            throw new Error(
                `Zone ${deploymentZone.id} cannot have more than ${deploymentZone.maxUnits} units`
            );
        }

        // Store the unit's deployment details.
        this._deployableUnitsMap.set(unitId, { zone: deploymentZone, location });

        // Update the zone's details (add unit, remove tile).
        deploymentZone.units.add(unitId);
        deploymentZone.tiles.delete(toTilePosString(location));

        // Update the unit's location and orientation.
        unit.location = location;
        unit.orientation = deploymentZone.orientation;
    }

    undeployUnit(unitId: UnitId): void {
        const unit = this.getUnit(unitId);
        if (!unit.location) {
            throw new Error(`Unit ${unitId} is not deployed`);
        }

        const deployment = this._deployableUnitsMap.get(unitId);
        if (!deployment) {
            throw new Error(`Unit ${unitId} is not deployed`);
        }

        // Clear the unit's deployment details.
        this._deployableUnitsMap.set(unitId, null);

        // Update the zone's details (remove unit, add tile).
        deployment.zone.units.delete(unitId);
        deployment.zone.tiles.add(toTilePosString(deployment.location));

        // Update the unit's location and orientation.
        unit.location = null;
        unit.orientation = Orientation.SOUTH;
    }

    private _randomTileInZone(zone: DeploymentZone): TilePos | null {
        if (zone.units.size >= (zone.maxUnits ?? Infinity) || zone.tiles.size === 0) {
            return null;
        }

        const tilePositions = Array.from(zone.tiles);
        const shuffled = ShuffleArray(tilePositions);
        const tilePosition = shuffled[Math.floor(Math.random() * tilePositions.length)];
        if (!tilePosition) {
            return null;
        }

        return new TilePos(fromTilePosString(tilePosition));
    }

    randomDeployment(unitId: UnitId): TilePos {
        const unit = this.getUnit(unitId);
        if (unit.location) {
            throw new Error(`Unit ${unitId} is already deployed`);
        }

        // Build a list of all the deployment zones that the unit can be deployed to.
        const deploymentZones = this._deploymentZones.filter(
            (zone) => zone.units.size < (zone.maxUnits ?? Infinity) && zone.tiles.size > 0
        );
        if (deploymentZones?.length === 0) {
            throw new Error(`No deployment zones available`);
        }

        // Build a list of all the tiles that the unit can be deployed to.
        const tilePositions = Array.from(deploymentZones.flatMap((zone) => Array.from(zone.tiles)));
        if (tilePositions.length === 0) {
            throw new Error(`No deployment tiles available`);
        }

        // Shuffle the list of tiles.
        const randomTilePosition = ShuffleArray(tilePositions);

        // Randomly select a tile to deploy the unit to.
        const tilePosition = randomTilePosition[Math.floor(Math.random() * tilePositions.length)];
        if (!tilePosition) {
            throw new Error(`No deployment tiles available`);
        }

        const tilePos = new TilePos(fromTilePosString(tilePosition));

        this.deployUnit(unitId, tilePos);

        return tilePos;
    }

    randomDeployAll(): void {
        const minimumPlacements: DeploymentZone[] = [];
        for (const zone of this._deploymentZones) {
            const deficit = (zone.minUnits ?? 0) - zone.units.size;
            for (let i = 0; i < deficit; i++) {
                minimumPlacements.push(zone);
            }
        }

        const shuffledMinimumPlacements = ShuffleArray(minimumPlacements);

        for (const zone of shuffledMinimumPlacements) {
            const undeployedUnits = this._units.filter((candidate) => !candidate.location);
            if (undeployedUnits.length === 0) {
                break;
            }

            const unit = undeployedUnits[Math.floor(Math.random() * undeployedUnits.length)];
            const tilePos = this._randomTileInZone(zone);
            if (!tilePos) {
                continue;
            }

            this.deployUnit(unit.id, tilePos);
        }

        for (const unit of this._units) {
            if (unit.location) {
                continue;
            }

            this.randomDeployment(unit.id);
        }
    }

    undeployAll(): void {
        for (const unit of [...this._units]) {
            if (unit.location) {
                this.undeployUnit(unit.id);
            }
        }
    }

    getMarkerRenderList(tilePos: ITilePos): RenderList {
        const zone = this.getDeploymentZone(tilePos);
        if (!zone) {
            return [];
        }

        const disabled = zone.units.size >= (zone.maxUnits ?? Infinity);

        return [{ imageId: this.deploymentMarker, opacity: disabled ? 0.5 : 1 }];
    }

    toDeploymentZoneSummary(): DeploymentZoneSummaryWire {
        return this._deploymentZones.map((zone) => ({
            id: zone.id,
            minUnits: zone.minUnits,
            maxUnits: zone.maxUnits,
            disabled: zone.units.size >= (zone.maxUnits ?? Infinity),
            orientation: zone.orientation,
            deployedCount: zone.units.size,
            outlineColor: zoneOutlineColor(zone),
            tiles: Array.from(zone.tiles.values()).map((tile) => fromTilePosString(tile)),
            allTiles: Array.from(zone.allTiles.values()).map((tile) => fromTilePosString(tile))
        }));
    }

    /**
     * Human-readable reason deployment cannot end, or null when it can.
     */
    get endDeploymentBlockedReason(): string | null {
        if (this._units.some((unit) => unit.location === null)) {
            return "All units must be deployed";
        }

        for (const zone of this._deploymentZones) {
            const minUnits = zone.minUnits ?? 0;
            if (zone.units.size < minUnits) {
                if (zone.units.size === 0) {
                    return `Zone ${zone.id} does not have any deployed units`;
                }
                return `Zone ${zone.id} requires at least ${minUnits} deployed unit${minUnits === 1 ? "" : "s"}`;
            }
        }

        return null;
    }

    /**
     * True when every unit is deployed and every zone meets its minUnits floor.
     */
    get canEndDeployment(): boolean {
        return this.endDeploymentBlockedReason === null;
    }
}
