import {
    Attribute,
    AttributeDef,
    Description,
    ErrorType,
    RenderList,
    RenderMode,
    TrackingSpeed,
    UnitSummary
} from "@atbs/shared-data";
import z from "zod";
import { SceneContext, SceneNode, SceneObject } from "./SceneObject.js";
import {
    Maths,
    Orientation,
    relativeDirection,
    rotateOrientation,
    TilePos,
    TilePosRecipe
} from "@atbs/maths";
import type { Side } from "./Side.js";
import type { Game } from "./Game.js";
import { MessageRouter } from "./MessageRouter.js";

const ROTATION_APT_COST = 1;
const INFINITE_ACTION_POINTS = false;

export const UnitRecipe = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
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
    collision: z.object({
        shape: z.literal("circle"),
        radius: z.number().positive()
    }),
    renderable: SceneNode
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
    private readonly _side: Side;

    private _location: TilePos | null;
    private _orientation: Orientation;

    constructor(
        recipe: Readonly<UnitRecipe>,
        overrides: Readonly<UnitOverrides>,
        additionalData: Readonly<UnitAdditionalData>
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
        this._location = overrides.location ? new TilePos(overrides.location) : null;
        this._orientation = recipe.isDirectional
            ? (overrides.orientation ?? Orientation.NORTH)
            : (overrides.orientation ?? Orientation.CENTER);
        this._side = additionalData.side;
    }

    get id() {
        return this._recipe.id;
    }

    get name() {
        return this._recipe.name;
    }

    get side() {
        return this._side;
    }

    get description() {
        return this._recipe.description;
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

    get weight() {
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
            {
                type: "server:error",
                payload: ErrorType.enum.INSUFFICIENT_ACTION_POINTS
            },
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

            const tile = game.worldMap.getTile(mapLocation);

            messageRouter.sendIfVisible(
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
                },
                mapLocation
            );
            messageRouter.sendIfVisible(
                {
                    type: "server:wait:time",
                    payload: 250
                },
                mapLocation
            );

            relativeRotation = relativeDirection(this.orientation, orientation);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    move(_game: Game, orientation: Orientation, _messageRouter: MessageRouter) {
        console.info("Moving", this.name, "in orientation", orientation);
    }

    toSummary(): UnitSummary {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            isDirectional: this.isDirectional,
            orientation: this.orientation,
            viewAngleInDegrees: this._recipe.viewAngleInDegrees,
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
                renderMode: RenderMode.enum.MAP_MODE,
                states: [] // TODO: Populate current states when we have an inventory etc.
            })
        };
    }
}
