import {
    Action,
    Actions,
    Attribute,
    AttributeDef,
    calcFireActionPointCost,
    DamageType,
    Description,
    ErrorType,
    FireMode,
    FireSelector,
    FireType,
    getAccuracy,
    getRpm,
    InterestMask,
    OnTarget,
    RenderList,
    RenderMode,
    SceneContext,
    SceneNode,
    SceneObject,
    shotsFired,
    TrackingSpeed,
    UnitId,
    UnitSummary,
    UnitType,
    VisualType
} from "@atbs/shared-data";
import z from "zod";
import {
    clamp,
    Colour,
    DebugGraphic,
    generateRandomBetween,
    ITilePos,
    Orientation,
    relativeDirection,
    rotateOrientation,
    TilePos,
    Vec2
} from "@atbs/maths";
import type { Side } from "./Side.js";
import type { Game } from "./Game.js";
import { MessageRouter } from "./MessageRouter.js";
import { Inventory, InventoryRecipe } from "./Inventory.js";
import { Item } from "./Item.js";
import cloneDeep from "lodash/cloneDeep.js";
import { assert } from "node:console";
import { Projectile, DEFAULT_PROJECTILE_TRAVEL_VELOCITY } from "./Projectile.js";
import { FurnitureDamageSystem } from "./FurnitureDamageSystem.js";
import { buildUnitDeathAnimation } from "../AnimationDefinitions.js";
import { ImageManager } from "./ImageManager.js";
import { config } from "../config/config.schema.js";
import { Logger } from "@atbs/misc";
import { IMPENETRABLE } from "./Obstruction.js";
import { Material } from "./Material.js";
import { MaterialManager } from "./MaterialManager.js";
import type { VisibilityViewer } from "./VisibilityViewer.js";
import type { VisibilityManager } from "./VisibilityManager.js";
import type { VisibilityPoi } from "./VisibilityPoi.js";
import type { WorldMap } from "./WorldMap.js";
import type { ItemManager } from "./ItemManager.js";
import type { FurnitureManager } from "./FurnitureManager.js";
import type { DamageCacheManager } from "./DamageCacheManager.js";
import isEqual from "lodash/isEqual.js";

const MAX_DISORIENTATION = 100;
const DISORIENTATION_REDUCTION_PER_TURN = 10;

const ROTATION_APT_COST = 1;

const STRAIGHT_MOVEMENT_APT_COST = 2;
const DIAGONAL_MOVEMENT_APT_COST = 3;

const DEFAULT_MOVEMENT_APT_COST_MAP: Record<Orientation, number> = {
    [Orientation.NORTH]: STRAIGHT_MOVEMENT_APT_COST,
    [Orientation.NORTH_EAST]: DIAGONAL_MOVEMENT_APT_COST,
    [Orientation.EAST]: STRAIGHT_MOVEMENT_APT_COST,
    [Orientation.SOUTH_EAST]: DIAGONAL_MOVEMENT_APT_COST,
    [Orientation.SOUTH]: STRAIGHT_MOVEMENT_APT_COST,
    [Orientation.SOUTH_WEST]: DIAGONAL_MOVEMENT_APT_COST,
    [Orientation.WEST]: STRAIGHT_MOVEMENT_APT_COST,
    [Orientation.NORTH_WEST]: DIAGONAL_MOVEMENT_APT_COST,
    [Orientation.CENTER]: 0
};

const DIRECTIONAL_MOVEMENT_APT_COST_MAP: Record<Orientation, number> = {
    [Orientation.NORTH]: 2,
    [Orientation.NORTH_EAST]: 3,
    [Orientation.EAST]: 3,
    [Orientation.SOUTH_EAST]: 4,
    [Orientation.SOUTH]: 4,
    [Orientation.SOUTH_WEST]: 4,
    [Orientation.WEST]: 3,
    [Orientation.NORTH_WEST]: 3,
    [Orientation.CENTER]: 0
};

export const UnitRecipe = z.object({
    id: UnitId,
    type: UnitType.default(UnitType.enum.human),
    name: z.string().nonempty(),
    description: Description,
    isDirectional: z.boolean().optional().default(true),
    viewAngleInDegrees: z.number().optional().default(90.0),
    viewRanges: z.array(z.number().positive()).nonempty().optional().default([1000]),
    attributes: z.object({
        actionPoints: AttributeDef,
        constitution: AttributeDef,
        fitness: AttributeDef,
        morale: AttributeDef,
        stamina: AttributeDef,
        speed: AttributeDef,
        strength: AttributeDef,
        weight: z.number().positive()
    }),
    inventory: InventoryRecipe,
    collision: z.object({
        shape: z.literal("circle"),
        radius: z.number().positive(),
        materials: z.array(z.string()).nonempty().default(["human.material"])
    }),
    visualType: VisualType.default(VisualType.enum.eyeball),
    renderable: SceneNode,
    actions: Actions
});
export type UnitRecipe = z.infer<typeof UnitRecipe>;

export const UnitOverrides = z
    .object({
        location: ITilePos,
        orientation: z.enum(Orientation).optional().default(Orientation.CENTER)
    })
    .partial();
export type UnitOverrides = z.infer<typeof UnitOverrides>;

export interface UnitAdditionalData {
    side: Side;
}

function setDefaultAttribute(attributeDef: AttributeDef): Attribute {
    return { max: attributeDef.max, value: attributeDef.value ?? attributeDef.max };
}

export function isUnit(arg: unknown): arg is Unit {
    return arg instanceof Unit;
}

export class Unit extends SceneObject implements VisibilityViewer {
    readonly logger: Logger;

    private readonly _recipe: Readonly<UnitRecipe>;
    private readonly _game: Game;
    private readonly _attributes: {
        actionPoints: Attribute;
        constitution: Attribute;
        fitness: Attribute;
        morale: Attribute;
        stamina: Attribute;
        speed: Attribute;
        strength: Attribute;
    };
    private readonly _materials: Material[];
    private readonly _inventory: Inventory;
    private readonly _side: Side;

    private _location: TilePos | null;
    private _orientation: Orientation;

    private _disorientation: number;

    private _canSee: Unit[];

    constructor(
        recipe: Readonly<UnitRecipe>,
        overrides: Readonly<UnitOverrides>,
        additionalData: Readonly<UnitAdditionalData>,
        game: Game
    ) {
        super(recipe.renderable);

        this._game = game;
        this.logger = new Logger(`Unit-${recipe.id}`, config.logLevels.unit);

        this._recipe = recipe;
        this._attributes = {
            actionPoints: setDefaultAttribute(recipe.attributes.actionPoints),
            constitution: setDefaultAttribute(recipe.attributes.constitution),
            fitness: setDefaultAttribute(recipe.attributes.fitness),
            morale: setDefaultAttribute(recipe.attributes.morale),
            stamina: setDefaultAttribute(recipe.attributes.stamina),
            speed: setDefaultAttribute(recipe.attributes.speed),
            strength: setDefaultAttribute(recipe.attributes.strength)
        };
        this._inventory = new Inventory(this._recipe.inventory, this.itemManager);
        this._location = overrides.location ? TilePos.parse(overrides.location) : null;
        this._orientation = recipe.isDirectional
            ? (overrides.orientation ?? Orientation.NORTH)
            : (overrides.orientation ?? Orientation.CENTER);
        this._side = additionalData.side;
        this._disorientation = 0;
        this._materials = recipe.collision.materials.map((materialId) =>
            MaterialManager.GetSingleton().getMaterial(materialId)
        );

        this.visibilityManager.addViewer(this);
        this._canSee = [];
    }

    get game(): Game {
        return this._game;
    }

    get map(): WorldMap {
        return this.game.map;
    }

    get itemManager(): ItemManager {
        return this.game.itemManager;
    }

    get furnitureManager(): FurnitureManager {
        return this.game.furnitureManager;
    }

    get visibilityManager(): VisibilityManager {
        return this.game.visibilityManager;
    }

    get damageCacheManager(): DamageCacheManager {
        return this.game.damageCacheManager;
    }

    get messageRouter(): MessageRouter {
        return this.game.messageRouter;
    }

    get id(): UnitId {
        return this._recipe.id;
    }

    get type(): UnitType {
        return this._recipe.type;
    }

    get name(): string {
        return this._recipe.name;
    }

    get side(): Side {
        return this._side;
    }

    get description(): Description {
        return this._recipe.description;
    }

    get inventory(): Inventory {
        return this._inventory;
    }

    get itemInUse(): Item | null {
        return this.inventory.itemInUse;
    }

    get location(): TilePos | null {
        return this._location;
    }

    get materials(): Material[] {
        return this._materials;
    }

    get mapLocation(): TilePos {
        if (!this._location) {
            throw new Error(`Unit ${this.id} is not on the map`);
        }

        return this._location;
    }

    set location(value: TilePos | null) {
        if (value === this._location) {
            return;
        }

        this._location = value;
        this.visibilityManager.invalidateViewerLocation(this.id);
    }

    get orientation(): Orientation {
        return this._orientation;
    }

    set orientation(value: Orientation) {
        if (value === this._orientation) {
            return;
        }

        this._orientation = value;
        this.visibilityManager.invalidateViewerOrientation(this.id);
    }

    get isDirectional(): boolean {
        return this._recipe.isDirectional;
    }

    get disorientated(): boolean {
        return this.disorientation > 0;
    }

    get disorientation(): number {
        return this._disorientation;
    }

    set disorientation(value: number) {
        value = clamp(value, 0, MAX_DISORIENTATION);

        console.info("Setting disorientation to", value);
        this._disorientation = value;
    }

    get isAlive(): boolean {
        return this.constitution > 0;
    }

    get isDead(): boolean {
        return this.constitution === 0;
    }

    get weight(): number {
        // TODO: Add in the weight of inventory?
        return this._recipe.attributes.weight;
    }

    get maxActionPoints(): number {
        return this._attributes.actionPoints.max;
    }

    get actionPoints(): number {
        return this._attributes.actionPoints.value;
    }

    get maxConstitution(): number {
        return this._attributes.constitution.max;
    }

    get constitution(): number {
        return this._attributes.constitution.value;
    }

    set constitution(value: number) {
        this._attributes.constitution.value = clamp(Math.floor(value), 0, this.maxConstitution);
    }

    get strength(): number {
        return this._attributes.strength.value;
    }

    get canFire(): boolean {
        return !!this.itemInUse?.canFire;
    }

    get canThrow(): boolean {
        return Action.enum.throw in this._recipe.actions && !!this.itemInUse;
    }

    get canAction(): boolean {
        return false;
    }

    get canInventory(): boolean {
        return false;
    }

    get weaponInaccuracyAngle() {
        return 10 + this.disorientation / 5;
    }

    get throwInaccuracyAngle() {
        return 10 + this.disorientation / 5;
    }

    get visualType(): VisualType {
        return this._recipe.visualType;
    }

    get viewAngleInDegrees(): number {
        return this._recipe.viewAngleInDegrees;
    }

    get viewRanges(): number[] {
        return this._recipe.viewRanges;
    }

    get canSee(): Unit[] {
        return this._canSee;
    }

    set canSee(value: Unit[]) {
        this._canSee = value;
    }

    getActions(): Actions {
        const actions = cloneDeep(this._recipe.actions);

        if (Action.enum.throw in actions) {
            actions[Action.enum.throw].accuracy = this.calcThrowAccuracy(
                actions[Action.enum.throw].accuracy
            );
            actions[Action.enum.throw].actionPoints = this.itemInUse?.throwActionPointCost ?? 0;
        }

        this.logger.dir({ actions });

        return actions;
    }

    getRenderList(context: SceneContext): RenderList {
        const unitContext = {
            ...context,
            states: [this.isAlive ? "alive" : "dead", this.itemInUse ? "item-in-use" : "default"],
            orientation: this.orientation,
            visibilityFilter: true
        };

        return super.getRenderList(unitContext);
    }

    private _hasSufficientActionPoints(aptCost: number): boolean {
        if (aptCost <= this.actionPoints) {
            return true;
        }

        this.messageRouter.send(
            { type: "server:error", payload: ErrorType.enum.INSUFFICIENT_ACTION_POINTS },
            this.side.id
        );
        return false;
    }

    private _useActionPoints(aptCost: number): boolean {
        if (aptCost > this.actionPoints) {
            throw new Error(
                `Unit ${this.id} does not have sufficient action points to deduct ${aptCost}`
            );
        }

        // Reduce the amount of disorientation based on the number of action points used.
        this.disorientation -= aptCost;

        if (!config.infiniteActionPoints) {
            this._attributes.actionPoints.value -= aptCost;

            this.messageRouter.send(
                {
                    type: "server:unit:selected:update",
                    payload: {
                        attributes: {
                            actionPoints: { value: this._attributes.actionPoints.value }
                        }
                    }
                },
                this.side.id
            );
        }

        // return this._inflictOngoingDamage(game, aptCost, eventList);

        return true;
    }

    private _verifyDirectional(): void | never {
        if (!this.isDirectional) {
            throw new Error(`Unit ${this.id} is not directional, so cannot be rotated`);
        }
    }

    startTurn() {
        this.logger.info("Starting turn");

        if (this.disorientated) {
            // Reduce the amount of disorientation based on the number of action points remaining...
            this.disorientation -= this.actionPoints + DISORIENTATION_REDUCTION_PER_TURN;
        }

        if (this.isAlive) {
            // TODO: Restore action points based on burden and wounds.
            // this._instance.attributes.actionPoints.max - (this._instance.attributes.burden * ACTION_POINT_LOSS_PER_BURDEN) - (this._instance.attributes.wounds * ACTION_POINT_LOSS_PER_WOUND)
            this._attributes.actionPoints.value = this.maxActionPoints;
        }

        // this.updateAvailableActions(game.map);
    }

    private _refreshVisibility(): void {
        const oldCanSee = this.canSee;

        if (config.showVisibilityDebugGraphics) {
            const debugGraphics: DebugGraphic[] = [];
            this.visibilityManager.update(undefined, debugGraphics);
            if (debugGraphics.length > 0) {
                this.messageRouter.send({
                    type: "server:debug:graphics",
                    payload: debugGraphics
                });
            }
        } else {
            this.visibilityManager.update();
        }

        // visibilityManager.update() refreshes every viewer; keep each unit's
        // canSee in sync so opposition units that newly see someone report the
        // correct count when later selected (toSummary → UnitsSeen).
        this.game.syncUnitsCanSee();

        if (!isEqual(oldCanSee, this.canSee)) {
            this.messageRouter.send(
                {
                    type: "server:unit:selected:update",
                    payload: { canSee: this.canSee.length }
                },
                this.side.id
            );
        }
    }

    /**
     * Sends every side its own visibility snapshot (visible tiles + friendly
     * viewer cone parameters). Because opposition messages are queued during
     * another side's turn, this interleaves each side's visibility into their
     * playback so fog-of-war and view cones stay in sync with map updates.
     */
    private _broadcastVisibleTiles(): void {
        for (const side of this.game.sides) {
            this.messageRouter.send(
                {
                    type: "server:visible:tiles",
                    payload: this.visibilityManager.getVisibilityUpdate(side.oppositionSideIds)
                },
                side.id
            );
        }
    }

    rotate(orientation: Orientation): void {
        this.logger.info("Rotating", this.name, "to orientation", orientation);

        this._verifyDirectional();

        const { mapLocation } = this;

        let relativeRotation = relativeDirection(this.orientation, orientation);
        if (Math.abs(relativeRotation) === 4 && generateRandomBetween(0, 1) > 0.5) {
            relativeRotation = -relativeRotation;
        }

        const aptCost = ROTATION_APT_COST * Math.abs(relativeRotation);

        if (!this._hasSufficientActionPoints(aptCost)) {
            return;
        }

        this.messageRouter.sendIfVisible(
            {
                type: "server:camera:move:to",
                payload: {
                    target: "tile",
                    tilePos: mapLocation,
                    trackingSpeed: TrackingSpeed.enum.MEDIUM
                }
            },
            mapLocation
        );

        while (Math.abs(relativeRotation) > 0) {
            this.orientation = rotateOrientation(this.orientation, Math.sign(relativeRotation));

            if (!this._useActionPoints(ROTATION_APT_COST)) {
                return;
            }

            // TODO: Update available actions.

            this._refreshVisibility();

            this.messageRouter.send(
                {
                    type: "server:unit:selected:update",
                    payload: { orientation: this._orientation, canSee: this.canSee.length }
                },
                this.side.id
            );

            const tile = this.map.getTile(mapLocation);

            this.messageRouter.sendIfVisible(
                [
                    { type: "server:wait:time", payload: 300 },
                    {
                        type: "server:map:update",
                        payload: [tile.generateTileUpdate()]
                    }
                ],
                mapLocation
            );
            this._broadcastVisibleTiles();

            relativeRotation = relativeDirection(this.orientation, orientation);
        }
    }

    move(orientation: Orientation): void {
        const { map } = this;

        const direction = this.isDirectional
            ? rotateOrientation(this.orientation, orientation)
            : orientation;

        let aptCost = this.isDirectional
            ? DIRECTIONAL_MOVEMENT_APT_COST_MAP[orientation]
            : DEFAULT_MOVEMENT_APT_COST_MAP[direction];

        const srcPos = new TilePos(this.mapLocation.col, this.mapLocation.row);
        const dstPos = srcPos.stepInDirection(direction);

        const dstTile = map.sampleTile(dstPos);
        if (!dstTile) {
            this.messageRouter.send(
                {
                    type: "server:error",
                    payload: ErrorType.enum.UNABLE_TO_MOVE_THERE
                },
                this.side.id
            );
            return;
        }

        const movementObstruction = dstTile.getMovementObstruction(this.type);
        if (movementObstruction === IMPENETRABLE || movementObstruction > 10) {
            this.messageRouter.send(
                { type: "server:error", payload: ErrorType.enum.UNABLE_TO_MOVE_THERE },
                this.side.id
            );
            return;
        }

        aptCost *= 1 /* + movementObstruction */;
        if (!this._hasSufficientActionPoints(aptCost)) {
            return;
        }

        // TODO: Overtaking stuff...

        if (!this._useActionPoints(aptCost)) {
            return;
        }

        const srcTile = map.getTile(this.mapLocation);
        srcTile.removeUnit(this);
        this.messageRouter.sendIfVisible(
            [
                { type: "server:wait:time", payload: 300 },
                { type: "server:map:update", payload: [srcTile.generateTileUpdate()] }
            ],
            srcPos
        );

        this.location = dstTile.location;
        dstTile.addUnit(this);
        this._refreshVisibility();

        this.messageRouter.send(
            {
                type: "server:unit:selected:update",
                payload: { location: this.location }
            },
            this.side.id
        );

        // Broadcast the post-move visibility set AFTER the source tile has been
        // cleared (so the old viewer location is no longer needed to keep the
        // departing sprite visible) and BEFORE the destination tile update (so
        // the arriving sprite is not briefly culled by a stale visibleTiles).
        this._broadcastVisibleTiles();

        this.messageRouter.sendIfVisible(
            [
                { type: "server:map:update", payload: [dstTile.generateTileUpdate()] },
                {
                    type: "server:camera:move:to",
                    payload: {
                        target: "tile",
                        tilePos: dstPos,
                        trackingSpeed: TrackingSpeed.enum.MEDIUM
                    }
                }
            ],
            dstPos
        );

        // this.updateAvailableActions(map);

        // visibilityManager.refresh({
        //     povUnit: this,
        //     speedScaler: 0.75,
        //     unitMoves: [this]
        // });

        // eventList.addEvents(
        //     { relativeToStartOfLastEvent: 0, duration: 250 },
        //     eventList.allSideIds,
        //     Event.UnitsChangeEvent(this),
        //     Event.VisibilityChangeEvent(visibilityManager.allForUI())
        // );
    }

    fire(
        weapon: Item,
        fireSelector: FireSelector,
        fireMode: FireMode,
        worldPoses: Vec2[],
        triggerHeldTimeInMs: number
    ): void {
        if (!this.itemInUse) {
            throw new Error("No item in use - but one was expected");
        }
        if (this.itemInUse.findByItemId(weapon.id) !== weapon) {
            throw new Error(`Weapon ${weapon.id} is not part of item in use ${this.itemInUse?.id}`);
        }

        const { map } = this;

        this.logger.info("Fire", {
            gameId: this.game.id,
            weaponId: weapon.id,
            fireSelector,
            fireMode,
            worldPoses,
            triggerHeldTimeInMs
        });

        const fireModes = weapon.getFireModes(this);
        const baseAccuracy = getAccuracy(fireModes, fireSelector, fireMode);
        const firstShotAccuracy = this.calcWeaponAccuracy(baseAccuracy);
        this.logger.dir({ firstShotAccuracy });

        const rpm = getRpm(fireModes, fireSelector);
        const numShots = shotsFired(triggerHeldTimeInMs, rpm);
        this.logger.dir({ numShotsFired: numShots });

        // Generate world poses - we have a 1:1 correspondence with the number of shots fired.
        assert(
            numShots === worldPoses.length,
            "Number of shots should equal the number of worldPoses we have been sent"
        );
        const targetWorldPoses = worldPoses.map(
            (worldPos) => worldPos.add({ x: 0.5, y: 0.5 }) // Move to the center of the pixel for accuracy.
        );
        this.logger.dir({ targetWorldPoses });

        const maxRange = weapon.loadedRound?.maxRange ?? 0; // TODO:
        this.logger.dir({ maxRange });

        const unitWorldPos = map.tileCenterToWorld(this.mapLocation);
        const collisionRadius = this._recipe.collision.radius;

        for (const [shot, toWorldPos] of targetWorldPoses.entries()) {
            const dir = toWorldPos.sub(unitWorldPos).normalise();
            const fromWorldPos = unitWorldPos.add(dir.scale(collisionRadius));

            this.logger.dir({ shot, srcWorldPos: fromWorldPos, dstWorldPos: toWorldPos });

            const range =
                weapon.fireType === FireType.enum.indirect
                    ? maxRange
                    : toWorldPos.sub(fromWorldPos).length;
            this.logger.dir({ range });

            // Perturb the range of this shot based on accuracy.
            const perturbedRange = Item.PerturbRange(range);
            this.logger.dir({ perturbedRange });

            // Calculate the direction of the shot.
            const dirVector = toWorldPos.sub(fromWorldPos).normalise();
            this.logger.dir({ dirVector });

            // Perturb the direction of this shot based on accuracy.
            const { dirVector: perturbedDirVector, accuracy } = Item.PerturbAccuracy(
                dirVector,
                firstShotAccuracy,
                this.weaponInaccuracyAngle
            );
            this.logger.dir({ perturbedDirVector, accuracy });

            const { initialAptCost, perShotAptCost } = calcFireActionPointCost(
                fireModes,
                fireSelector,
                fireMode
            );
            const aptCost = shot === 0 ? initialAptCost : perShotAptCost;
            this.logger.dir({ shot, aptCost, initialAptCost, perShotAptCost });

            if (!this._hasSufficientActionPoints(aptCost)) {
                return;
            }

            if (weapon.isEmpty) {
                this.messageRouter.send(
                    { type: "server:error", payload: ErrorType.enum.INSUFFICIENT_AMMO },
                    this.side.id
                );
            }

            if (!this._useActionPoints(aptCost)) {
                return;
            }

            const round = weapon.fire();
            this.logger.dir({ round });

            this.messageRouter.send(
                {
                    type: "server:unit:weapon:update",
                    payload: this.itemInUse.getFireModeItemSummary(this)
                },
                this.side.id
            );

            const { projectileRecipe } = round;
            const { numProjectiles } = projectileRecipe;
            const spreadAngleInRadians = weapon.spreadAngleInRadians;
            const startOfSpread = -spreadAngleInRadians / 2;
            const angleScaler =
                numProjectiles > 1 ? spreadAngleInRadians / (numProjectiles - 1) : 0;

            this.logger.dir({ numProjectiles });

            const projectiles = [...Array(numProjectiles).keys()].map((projectileIndex) => {
                const perturbedAngle = startOfSpread + angleScaler * projectileIndex;
                const directionVector = perturbedDirVector.rotate(perturbedAngle);

                this.logger.dir({ perturbedAngle, directionVector, fromWorldPos });

                return new Projectile({
                    game: this.game,
                    firingUnit: this,
                    firingWeapon: weapon,
                    projectileIndex,
                    roundIndex: shot,
                    srcPos: fromWorldPos,
                    directionVector,
                    // TEMPORARY: Override the maxium range of the projectile to be the target position.
                    projectileRecipe: {
                        ...projectileRecipe
                        // maxRange: toWorldPos.sub(fromWorldPos).length
                    }
                });
            });

            const showDebugGraphics = config.showProjectileDebugGraphics;
            const debugGraphics: DebugGraphic[] = [];
            const imageManager = ImageManager.GetSingleton();
            const roundDamageCache = this.damageCacheManager.createRoundInstance(imageManager);

            const furnitureDamageSystem = new FurnitureDamageSystem(roundDamageCache, map.tileSize);

            Projectile.ProcessProjectiles(
                projectiles,
                map,
                debugGraphics,
                roundDamageCache,
                furnitureDamageSystem,
                (projectile, tile, samplePos, sample, timeMs) => {
                    furnitureDamageSystem.onMaterialPixel(
                        projectile,
                        tile,
                        samplePos,
                        sample,
                        timeMs
                    );
                }
            );

            const tileUpdates = [...furnitureDamageSystem.timedUpdates].sort(
                (a, b) => a.timeMs - b.timeMs
            );

            const deaths = furnitureDamageSystem.unitDeaths.map(buildUnitDeathAnimation);

            roundDamageCache.adoptInto(this.damageCacheManager, imageManager);

            const centerProjectile = projectiles.find((projectile) => projectile.index === 0)!;
            const onTarget = centerProjectile.passesNear(toWorldPos, 1);
            this.logger.dir({ onTarget });

            if (showDebugGraphics && debugGraphics) {
                this.messageRouter.send({
                    type: "server:debug:graphics",
                    payload: debugGraphics
                });
            }

            // TODO: Move the projectiles forward in time...
            // TODO: Psuedo tracers - how do we determine visibility?
            this.messageRouter.send([
                {
                    type: "server:fire:trace",
                    payload: {
                        tracers: projectiles.map((projectile) => projectile.getTracer()),
                        isOnTarget: onTarget ? OnTarget.enum.onTarget : OnTarget.enum.offTarget,
                        tileUpdates,
                        deaths
                    }
                }
            ]);

            // A death can remove a viewer/blocker and open up sightlines, so
            // recompute visibility and push each side its updated visible tiles.
            // Queued after the trace, this applies once playback of the death has
            // finished on the observing client.
            if (deaths.length > 0) {
                this._refreshVisibility();
                this._broadcastVisibleTiles();
            }
        }
    }

    throw(worldPos: Vec2): void {
        const { itemInUse: itemToThrow } = this;

        if (!itemToThrow) {
            throw new Error("No item in use - but one was expected");
        }

        const { map } = this;

        this.logger.info("Throw", {
            gameId: this.game.id,
            itemId: itemToThrow.id,
            worldPos
        });

        const aptCost = itemToThrow.throwActionPointCost;
        if (!this._hasSufficientActionPoints(aptCost)) {
            return;
        }

        const toWorldPos = worldPos;
        console.info(
            "Unit",
            this.id,
            "attempting to throw",
            itemToThrow.name,
            "to",
            toWorldPos.toString()
        );

        const { accuracy: baseAccuracy } = this._recipe.actions.throw;
        const throwAccuracy = this.calcThrowAccuracy(baseAccuracy);
        console.info({ baseAccuracy, throwAccuracy });

        const maxThrowDistance = this.calcThrowMaxRange(itemToThrow);
        console.info({ maxThrowDistance });

        const unitPos = map.tileOffsetToWorld(this.mapLocation);
        console.info({ unitPos: unitPos.toString() });

        const throwVec = toWorldPos.sub(unitPos);
        const throwDir = throwVec.normalise();
        const throwDistance = throwVec.length;
        console.info({
            throwVec: throwVec.toString(),
            throwDir: throwDir.toString(),
            throwDistance
        });

        const {
            dirVector: perturbedDir,
            accuracy,
            onTarget
        } = Item.PerturbAccuracy(throwDir, throwAccuracy, this.throwInaccuracyAngle);
        console.info({
            perturbedDir: perturbedDir.toString(),
            targeting: onTarget ? "OnTarget" : `OffTarget(${accuracy}%)`
        });

        const perturbedDistance = Item.PerturbRange(throwDistance);
        console.info({ perturbedDistance });

        const limitedPerturbedDistance = Math.min(perturbedDistance, maxThrowDistance);
        console.info({ limitedPerturbedDistance });

        const unitWorldPos = map.tileCenterToWorld(this.mapLocation);
        const dir = toWorldPos.sub(unitWorldPos).normalise();
        const { radius: collisionRadius } = this._recipe.collision;
        const fromWorldPos = unitWorldPos.add(dir.scale(collisionRadius));
        this.logger.dir({ srcWorldPos: fromWorldPos, dstWorldPos: toWorldPos });

        const perturbedTargetWorldPos = fromWorldPos.add(
            perturbedDir.scale(limitedPerturbedDistance)
        );
        console.info({
            perturbedTargetWorldPos: perturbedTargetWorldPos.toString()
        });

        if (!this._useActionPoints(aptCost)) {
            return;
        }

        const throwImpactVelocityMps = Math.min(
            30,
            Math.max(6, Math.sqrt(this.strength / itemToThrow.weight) * 4)
        );

        const projectile = new Projectile({
            game: this.game,
            firingUnit: this,
            firingWeapon: itemToThrow,
            projectileIndex: 0,
            roundIndex: 0,
            srcPos: fromWorldPos,
            directionVector: perturbedDir,
            projectileRecipe: {
                numProjectiles: 1,
                maxRange: limitedPerturbedDistance,
                perturbation: 0,
                visual: {
                    headColour: Colour.White,
                    headRadiusInPixels: 2,
                    trailColour: Colour.White,
                    trailLengthInPixels: 100,
                    rangeFalloffPower: 20
                },
                damage: { default: 0, type: "default" },
                mass: itemToThrow.weight,
                velocity: DEFAULT_PROJECTILE_TRAVEL_VELOCITY,
                impactVelocity: throwImpactVelocityMps,
                diameter: 40,
                hardness: 0,
                shape: 0,
                stability: 0.2,
                bounce: 1,
                delivery: "thrown",
                integrity: 0
            }
        });

        const showDebugGraphics = config.showProjectileDebugGraphics;
        const debugGraphics: DebugGraphic[] = [];
        const imageManager = ImageManager.GetSingleton();
        const roundDamageCache = this.damageCacheManager.createRoundInstance(imageManager);

        const furnitureDamageSystem = new FurnitureDamageSystem(roundDamageCache, map.tileSize);

        Projectile.ProcessProjectiles(
            [projectile],
            map,
            debugGraphics,
            roundDamageCache,
            furnitureDamageSystem,
            (projectile, tile, samplePos, sample, timeMs) => {
                // TODO: Work out what to do with the item when it hits a surface.
                furnitureDamageSystem.onMaterialPixel(projectile, tile, samplePos, sample, timeMs);
            }
        );

        // TODO:
        // - Update the unit so they are not holding.
        // - Position the item on the ground (rounded).
        // - Update the

        if (showDebugGraphics && debugGraphics) {
            this.messageRouter.send({
                type: "server:debug:graphics",
                payload: debugGraphics
            });
        }

        const tileUpdates = [...furnitureDamageSystem.timedUpdates].sort(
            (a, b) => a.timeMs - b.timeMs
        );

        const deaths = furnitureDamageSystem.unitDeaths.map(buildUnitDeathAnimation);

        roundDamageCache.adoptInto(this.damageCacheManager, imageManager);

        const { pos: finalWorldPos, time: finalTime } = projectile.finalPostionAndTime;

        // Work out which tile the item landed in.
        const landingTilePos = map.worldToTile(finalWorldPos);
        console.info({ landingTile: landingTilePos });

        const landingTile = map.getTile(landingTilePos);

        itemToThrow.location = landingTilePos;
        landingTile.addItem(itemToThrow);
        this.inventory.removeItem(itemToThrow);

        // Update the unit's tile, because they are no longer holding the item.
        tileUpdates.push(map.getTile(this.mapLocation).generateTimedTileUpdate(finalTime));

        // Update the landing tile, because the item is now on the ground.
        tileUpdates.push(landingTile.generateTimedTileUpdate(finalTime));

        // TODO: Move the projectiles forward in time...
        // TODO: Psuedo tracers - how do we determine visibility?
        this.messageRouter.send([
            {
                type: "server:fire:trace",
                payload: {
                    tracers: [projectile.getTracer()],
                    isOnTarget: onTarget ? OnTarget.enum.onTarget : OnTarget.enum.offTarget,
                    tileUpdates,
                    deaths
                }
            }
        ]);

        // A death can remove a viewer/blocker and open up sightlines, so
        // recompute visibility and push each side its updated visible tiles.
        // Queued after the trace, this applies once playback of the death has
        // finished on the observing client.
        if (deaths.length > 0) {
            this._refreshVisibility();
            this._broadcastVisibleTiles();
        }

        this.messageRouter.send(
            {
                type: "server:unit:selected:update",
                payload: {
                    interactions: {
                        canFire: this.canFire,
                        canThrow: this.canThrow,
                        canAction: this.canAction,
                        canInventory: this.canInventory
                    },
                    itemInUse: null
                }
            },
            this.side.id
        );
    }

    get disorientationScaler() {
        const disorientationProportion = this.disorientation / MAX_DISORIENTATION;
        const invDisorientationProportion = 1 - disorientationProportion;
        const power = 2;
        const invDisorientationProportionRaisedToPower = Math.pow(
            invDisorientationProportion,
            power
        );
        const clampedDisorientationScaler = clamp(invDisorientationProportionRaisedToPower, 0.1, 1);

        return clampedDisorientationScaler;
    }

    calcWeaponAccuracy(baseAccuracy: number): number {
        return clamp(Math.floor(baseAccuracy * this.disorientationScaler * 0.5), 0, 100);
    }

    calcThrowAccuracy(baseAccuracy: number): number {
        return clamp(Math.floor(baseAccuracy * this.disorientationScaler * 0.5), 0, 100);
    }

    calcThrowMaxRange(item: Item) {
        // TODO: Validate that this is good enough...
        return Math.floor(this.strength / Math.pow(item.weight, 2)) * 400;
    }

    inflictDamage(_worldPos: Vec2, projectile: Projectile): boolean {
        if (!this.isAlive) {
            return false;
        }

        const previousConstitution = this.constitution;
        const { type: damageType, amount: damageAmount } = projectile.calcDamage(this.type);

        switch (damageType) {
            case DamageType.enum.default: {
                this.constitution -= damageAmount;
                break;
            }

            case DamageType.enum.disorientation:
                this.disorientation += damageAmount;
                break;
        }

        return previousConstitution > 0 && this.constitution === 0;
    }

    toSummary(): UnitSummary {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            location: this.mapLocation,
            isDirectional: this.isDirectional,
            orientation: this.orientation,
            disorientation: this.disorientation,
            viewAngleInDegrees: this._recipe.viewAngleInDegrees,
            collisionRadius: this._recipe.collision.radius,
            canSee: this.canSee.length,
            attributes: {
                actionPoints: this._attributes.actionPoints,
                constitution: this._attributes.constitution,
                fitness: this._attributes.fitness,
                morale: this._attributes.morale,
                stamina: this._attributes.stamina,
                speed: this._attributes.speed,
                strength: this._attributes.strength,
                weight: this.weight
            },
            uiImage: this.getRenderList({
                renderMode: RenderMode.enum.UI_MODE,
                states: ["alive", this.itemInUse ? "item-in-use" : "default"]
            }),
            interactions: {
                canFire: this.canFire,
                canThrow: this.canThrow,
                canAction: this.canAction,
                canInventory: this.canInventory
            },
            itemInUse: this.itemInUse?.getItemSummary(this) ?? null,
            actions: this.getActions()
        };
    }

    get interestMasks(): InterestMask[] {
        return ["items", "vfx", ...this.side.oppositionSideIds];
    }

    get pois(): VisibilityPoi[] {
        return this.visibilityManager.getPois(this.interestMasks);
    }

    getVisibleUnits(): Unit[] {
        const { game, side, visibilityManager } = this;

        const oppositionUnits = game.getOppositionUnitsForSide(side.id);

        return oppositionUnits.filter(({ mapLocation }) => {
            const tile = game.map.getTile(mapLocation);
            return visibilityManager.isPoiVisibleForMasks(tile, this.interestMasks);
        });
    }
}
