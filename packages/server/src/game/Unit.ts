import {
    Action,
    Actions,
    Attribute,
    AttributeDef,
    calcFireActionPointCost,
    Description,
    ErrorType,
    FireMode,
    FireSelector,
    FireType,
    getAccuracy,
    getRpm,
    OnTarget,
    RenderList,
    RenderMode,
    shotsFired,
    TrackingSpeed,
    UnitId,
    UnitSummary,
    UnitType
} from "@atbs/shared-data";
import z from "zod";
import { SceneContext, SceneNode, SceneObject } from "./SceneObject.js";
import {
    Maths,
    Orientation,
    relativeDirection,
    rotateOrientation,
    TilePos,
    TilePosRecipe,
    Vec2
} from "@atbs/maths";
import type { Side } from "./Side.js";
import type { Game } from "./Game.js";
import { MessageRouter } from "./MessageRouter.js";
import { Clamp } from "../../../maths/src/Maths.js";
import { Inventory, InventoryRecipe } from "./Inventory.js";
import { ItemManager } from "./ItemManager.js";
import type { Item } from "./Item.js";
import cloneDeep from "lodash/cloneDeep.js";
import { assert } from "node:console";
import { Projectile } from "./Projectile.js";

const ROTATION_APT_COST = 1;
const INFINITE_ACTION_POINTS = true;

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
        radius: z.number().positive()
    }),
    renderable: SceneNode,
    actions: Actions
});
export type UnitRecipe = z.infer<typeof UnitRecipe>;

export const UnitOverrides = z
    .object({
        location: TilePosRecipe,
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

export class Unit extends SceneObject {
    private readonly _recipe: Readonly<UnitRecipe>;
    private readonly _attributes: {
        actionPoints: Attribute;
        constitution: Attribute;
        fitness: Attribute;
        morale: Attribute;
        stamina: Attribute;
        speed: Attribute;
        strength: Attribute;
    };
    private readonly _inventory: Inventory;
    private readonly _side: Side;

    private _location: TilePos | null;
    private _orientation: Orientation;

    constructor(
        recipe: Readonly<UnitRecipe>,
        overrides: Readonly<UnitOverrides>,
        additionalData: Readonly<UnitAdditionalData>,
        itemManager: ItemManager
    ) {
        super(recipe.renderable);

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
        this._inventory = new Inventory(this._recipe.inventory, itemManager);
        this._location = overrides.location ? new TilePos(overrides.location) : null;
        this._orientation = recipe.isDirectional
            ? (overrides.orientation ?? Orientation.NORTH)
            : (overrides.orientation ?? Orientation.CENTER);
        this._side = additionalData.side;
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

    get mapLocation(): TilePos {
        if (!this._location) {
            throw new Error(`Unit ${this.id} is not on the map`);
        }

        return this._location;
    }

    set location(value: TilePos | null) {
        this._location = value;
    }

    get orientation(): Orientation {
        return this._orientation;
    }

    get isDirectional(): boolean {
        return this._recipe.isDirectional;
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

    get strength(): number {
        return this._attributes.strength.value;
    }

    get canFire(): boolean {
        return !!this.itemInUse?.canFire;
    }

    get canThrow(): boolean {
        return Action.enum.throw in this._recipe.actions && !!this.itemInUse;
    }

    getActions(): Actions {
        const actions = cloneDeep(this._recipe.actions);

        if (Action.enum.throw in actions) {
            actions[Action.enum.throw].accuracy = this.calcThrowAccuracy(
                actions[Action.enum.throw].accuracy
            );
        }

        console.dir({ actions });

        return actions;
    }

    getRenderList(context: SceneContext): RenderList {
        const unitContext = {
            ...context,
            states: [this.isAlive ? "alive" : "dead"],
            orientation: this.orientation
        };

        return super.getRenderList(unitContext);
    }

    private _hasSufficientActionPoints(
        _game: Game,
        aptCost: number,
        messageRouter: MessageRouter
    ): boolean {
        if (aptCost <= this.actionPoints) {
            return true;
        }

        messageRouter.send(
            { type: "server:error", payload: ErrorType.enum.INSUFFICIENT_ACTION_POINTS },
            this.side.id
        );
        return false;
    }

    private _useActionPoints(_game: Game, aptCost: number, messageRouter: MessageRouter): boolean {
        if (aptCost > this.actionPoints) {
            throw new Error(
                `Unit ${this.id} does not have sufficient action points to deduct ${aptCost}`
            );
        }

        // Reduce the amount of disorientation based on the number of action points used.
        // this._disorientation = Math.max(0, this._disorientation - aptCost);

        if (!INFINITE_ACTION_POINTS) {
            this._attributes.actionPoints.value -= aptCost;

            messageRouter.send(
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
        console.info("Starting turn for unit", this.id);

        // if (this.disorientated) {
        //     // Reduce the amount of disorientation based on the number of action points remaining...
        //     this.disorientation -= this.actionPoints + DISORIENTATION_REDUCTION_PER_TURN;
        // }

        if (this.isAlive) {
            // TODO: Restore action points based on burden and wounds.
            // this._instance.attributes.actionPoints.max - (this._instance.attributes.burden * ACTION_POINT_LOSS_PER_BURDEN) - (this._instance.attributes.wounds * ACTION_POINT_LOSS_PER_WOUND)
            this._attributes.actionPoints.value = this.maxActionPoints;
        }

        // this.updateAvailableActions(game.map);
    }

    rotate(game: Game, orientation: Orientation, messageRouter: MessageRouter): void {
        console.info("Rotating", this.name, "to orientation", orientation);

        this._verifyDirectional();

        const { mapLocation } = this;

        let relativeRotation = relativeDirection(this.orientation, orientation);
        if (Math.abs(relativeRotation) === 4 && Maths.Random(0, 1) > 0.5) {
            relativeRotation = -relativeRotation;
        }

        const aptCost = ROTATION_APT_COST * Math.abs(relativeRotation);

        if (!this._hasSufficientActionPoints(game, aptCost, messageRouter)) {
            return;
        }

        messageRouter.sendIfVisible(
            {
                type: "server:camera:move:to",
                payload: {
                    target: "tile",
                    tilePos: [mapLocation.col, mapLocation.row],
                    trackingSpeed: TrackingSpeed.enum.MEDIUM
                }
            },
            mapLocation
        );

        while (Math.abs(relativeRotation) > 0) {
            this._orientation = rotateOrientation(this.orientation, Math.sign(relativeRotation));

            messageRouter.send(
                {
                    type: "server:unit:selected:update",
                    payload: { orientation: this._orientation }
                },
                this.side.id
            );

            if (!this._useActionPoints(game, ROTATION_APT_COST, messageRouter)) {
                return;
            }

            // TODO: Update available actions.
            // TODO: Refresh visibility (just yours).

            const tile = game.map.getTile(mapLocation);

            messageRouter.sendIfVisible(
                [
                    { type: "server:wait:time", payload: 300 },
                    {
                        type: "server:map:update",
                        payload: [
                            {
                                tilePos: [mapLocation.col, mapLocation.row],
                                tileByRenderMode: {
                                    [RenderMode.enum.MAP_MODE]: tile.getRenderList({
                                        renderMode: RenderMode.enum.MAP_MODE,
                                        states: []
                                    }),
                                    [RenderMode.enum.FIRE_MODE]: tile.getRenderList({
                                        renderMode: RenderMode.enum.FIRE_MODE,
                                        states: []
                                    })
                                }
                            }
                        ]
                    }
                ],
                mapLocation
            );

            relativeRotation = relativeDirection(this.orientation, orientation);
        }
    }

    move(game: Game, orientation: Orientation, messageRouter: MessageRouter): void {
        const { map } = game;

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
            messageRouter.send(
                {
                    type: "server:error",
                    payload: ErrorType.enum.UNABLE_TO_MOVE_THERE
                },
                this.side.id
            );
            return;
        }

        // const movementObstruction = dstTile.getMovementObstruction(this.unitType);
        // if (movementObstruction === IMPENETRABLE || movementObstruction > 10) {
        //     eventList.addEvents({ relativeToStartTime: 0 }, [this.sideId], Event.ErrorEvent(ErrorType.UNABLE_TO_MOVE_THERE));
        //     return false;
        // }

        aptCost *= 1 /* + movementObstruction */;
        if (!this._hasSufficientActionPoints(game, aptCost, messageRouter)) {
            return;
        }

        // TODO: Overtaking stuff...

        if (!this._useActionPoints(game, aptCost, messageRouter)) {
            return;
        }

        const srcTile = map.getTile(this.mapLocation);
        srcTile.removeUnit(this);
        messageRouter.sendIfVisible(
            [
                { type: "server:wait:time", payload: 300 },
                {
                    type: "server:map:update",
                    payload: [
                        {
                            tilePos: [srcPos.col, srcPos.row],
                            tileByRenderMode: {
                                [RenderMode.enum.MAP_MODE]: srcTile.getRenderList({
                                    renderMode: RenderMode.enum.MAP_MODE,
                                    states: []
                                }),
                                [RenderMode.enum.FIRE_MODE]: srcTile.getRenderList({
                                    renderMode: RenderMode.enum.FIRE_MODE,
                                    states: []
                                })
                            }
                        }
                    ]
                }
            ],
            srcPos
        );

        this.location = dstTile.location;
        messageRouter.send(
            {
                type: "server:unit:selected:update",
                payload: { location: [this.location.col, this.location.row] }
            },
            this.side.id
        );

        dstTile.addUnit(this);
        messageRouter.sendIfVisible(
            [
                {
                    type: "server:map:update",
                    payload: [
                        {
                            tilePos: [dstPos.col, dstPos.row],
                            tileByRenderMode: {
                                [RenderMode.enum.MAP_MODE]: dstTile.getRenderList({
                                    renderMode: RenderMode.enum.MAP_MODE,
                                    states: []
                                }),
                                [RenderMode.enum.FIRE_MODE]: dstTile.getRenderList({
                                    renderMode: RenderMode.enum.FIRE_MODE,
                                    states: []
                                })
                            }
                        }
                    ]
                },
                {
                    type: "server:camera:move:to",
                    payload: {
                        target: "tile",
                        tilePos: [dstPos.col, dstPos.row],
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
        game: Game,
        weapon: Item,
        fireSelector: FireSelector,
        fireMode: FireMode,
        worldPoses: Vec2[],
        triggerHeldTimeInMs: number,
        messageRouter: MessageRouter
    ): void {
        if (!this.itemInUse) {
            throw new Error("No item in use - but on was expected");
        }
        if (this.itemInUse.findByItemId(weapon.id) !== weapon) {
            throw new Error(`Weapon ${weapon.id} is not part of item in use ${this.itemInUse?.id}`);
        }

        const { map } = game;

        console.info("Fire", {
            gameId: game.id,
            weaponId: weapon.id,
            fireSelector,
            fireMode,
            worldPoses,
            triggerHeldTimeInMs
        });

        const fireModes = weapon.getFireModes(this);
        const baseAccuracy = getAccuracy(fireModes, fireSelector, fireMode);
        const firstShotAccuracy = this.calcWeaponAccuracy(baseAccuracy);
        console.dir({ firstShotAccuracy });

        const rpm = getRpm(fireModes, fireSelector);
        const numShots = shotsFired(triggerHeldTimeInMs, rpm);
        console.dir({ numShotsFired: numShots });

        // Generate world poses - we have a 1:1 correspondence with the number of shots fired.
        assert(
            numShots !== worldPoses.length,
            "Number of shots should equal the number of worldPoses we have been sent"
        );
        const targetWorldPoses = worldPoses.map(
            (worldPos) => worldPos.add({ x: 0.5, y: 0.5 }) // Move to the center of the pixel for accuracy.
        );
        console.dir({ targetWorldPoses });

        const maxRange = weapon.loadedRound?.maxRange ?? 0;
        console.dir({ maxRange });

        const unitWorldPos = map.tileCenterToWorld(this.mapLocation);
        const collisionRadius = this._recipe.collision.radius;

        for (const [shot, toWorldPos] of targetWorldPoses.entries()) {
            const dir = toWorldPos.sub(unitWorldPos).normalise();
            const fromWorldPos = unitWorldPos.add(dir.scale(collisionRadius));

            console.dir({ shot, srcWorldPos: fromWorldPos, tgtWorldPos: toWorldPos });

            const range =
                weapon.fireType === FireType.enum.indirect
                    ? maxRange
                    : toWorldPos.sub(fromWorldPos).length;
            console.dir({ range });

            // TODO: Perturb the range based on the accuracy of this shot.
            const perturbedRange = range * 1.0;
            console.dir({ perturbedRange });

            // Calculate the direction of the shot.
            const dirVector = toWorldPos.sub(fromWorldPos).normalise();
            console.dir({ dirVector });

            // TODO: Perturn the direction based on the accuracy of this shot.
            const perturbedDirVector = dirVector;
            const onTarget = Math.random() < 0.5;
            console.dir({ perturbedDirVector, onTarget });

            const { initialAptCost, perShotAptCost } = calcFireActionPointCost(
                fireModes,
                fireSelector,
                fireMode
            );
            const aptCost = shot === 0 ? initialAptCost : perShotAptCost;
            console.dir({ shot, aptCost, initialAptCost, perShotAptCost });

            if (!this._hasSufficientActionPoints(game, aptCost, messageRouter)) {
                return;
            }

            if (weapon.isEmpty) {
                messageRouter.send(
                    { type: "server:error", payload: ErrorType.enum.INSUFFICIENT_AMMO },
                    this.side.id
                );
            }

            if (!this._useActionPoints(game, aptCost, messageRouter)) {
                return;
            }

            const round = weapon.fire();
            console.dir({ round });

            messageRouter.send(
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

            console.dir({ numProjectiles });

            const projectiles = [...Array(numProjectiles).keys()].map((index) => {
                const perturbedAngle = startOfSpread + angleScaler * index;
                const directionVector = perturbedDirVector.rotate(perturbedAngle);

                console.dir({ perturbedAngle, directionVector, fromWorldPos });

                return new Projectile({
                    game,
                    firingUnit: this,
                    firingWeapon: weapon,
                    index,
                    srcPos: fromWorldPos,
                    directionVector,
                    projectileRecipe
                });
            });

            // Sort so that fastest projectiles are first.
            projectiles.sort((a, b) => b.velocity - a.velocity);
            console.dir({ projectiles });

            // TODO: Move the projectiles forward in time...
            // TODO: Psuedo tracers - how do we determine visibility?
            messageRouter.send([
                {
                    type: "server:fire:trace",
                    payload: {
                        tracers: projectiles.map((projectile) => projectile.getTracer()),
                        isOnTarget: onTarget ? OnTarget.enum.onTarget : OnTarget.enum.offTarget
                    }
                }
            ]);
        }

        /**
            const projectiles = [...Array(numProjectiles).keys()].map((index) => {
                const perturbedAngle = startOfSpread + angleScaler * index;
                const directionVector = perturbedDirVector.rotate(perturbedAngle);

                return new Projectile(
                    {
                        game,
                        firer: this,
                        firerPos,
                        directionVector,
                        maxRange: perturbedRange,
                        velocity: round.resolveVelocity,
                        penetration: round.penetration,
                        damage: round.damage
                    },
                    eventList
                );
            });

            // Sort so that fastest projectiles are first.
            projectiles.sort((a, b) => b.velocity - a.velocity);

            // Set a checkpoint so everything is relative to the start of the checkpoint.
            eventList.setCheckpoint({ relativeToEndOfLastEvent: 0 });
            projectiles.forEach((projectile) => projectile.trace());

            const maxProjectileTravelTime = projectiles.reduce((max, projectile) => Math.max(max, projectile.totalRangeTravelled), 0);
            eventList.addEvents(
                {
                    relativeToCheckpointTime: 0,
                    duration: maxProjectileTravelTime
                },
                eventList.allSideIds,
                Event.TraceEvent(
                    projectiles.map((projectile) => ({
                        srcPos: projectile.srcPos,
                        dstPos: projectile.finalPos,
                        distanceTravelled: projectile.distanceTravelled,
                        maxRange: projectile.maxRange,
                        length: round.resolveLength,
                        velocity: projectile.velocity,
                        intensity: round.resolveIntensity,
                        rangeFallOff: round.resolveRangeFallOff
                    })),
                    onTarget
                ),
                Event.UnitsChangeEvent(this)
            );
            eventList.addEvents(
                {
                    relativeToEndOfLastEvent: FIRE_ADDITIONAL_SIMULATION_TIME,
                    duration: 1000
                },
                [this.sideId],
                Event.CameraEvent(worldPoses[0])
            );

            projectiles.forEach((projectile) => {
                round.explosion?.explode(game, projectile.finalPos, projectile.dirVec, eventList);
            });
        }T
         */
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    throw(game: Game, worldPos: Vec2, _messageRouter: MessageRouter): void {
        console.info("Throw", { gameId: game.id, itemId: this.itemInUse!.id, worldPos });
    }

    calcWeaponAccuracy(baseAccuracy: number): number {
        return Clamp(baseAccuracy, 0, 100);
        // return Math.floor(baseAccuracy * this.disorientationScaler * 0.5);
    }

    calcThrowAccuracy(baseAccuracy: number): number {
        return Clamp(baseAccuracy, 0, 100);
        // return Math.floor(baseAccuracy * this.disorientationScaler * 0.5);
    }

    calcThrowMaxRange(item: Item) {
        // TODO: Validate that this is good enough...
        return Math.floor(this.strength / Math.pow(item.weight, 2)) * 400;
    }

    toSummary(): UnitSummary {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            location: [this.mapLocation.col, this.mapLocation.row],
            isDirectional: this.isDirectional,
            orientation: this.orientation,
            viewAngleInDegrees: this._recipe.viewAngleInDegrees,
            collisionRadius: this._recipe.collision.radius,
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
                canAction: false,
                canInventory: false
            },
            itemInUse: this.itemInUse?.getItemSummary(this) ?? null,
            actions: this.getActions()
        };
    }
}
