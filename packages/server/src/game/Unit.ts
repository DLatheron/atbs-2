import {
    Attribute,
    AttributeDef,
    Description,
    RenderList,
    RenderMode,
    UnitSummary
} from "@atbs/shared-data";
import z from "zod";
import { SceneContext, SceneNode, SceneObject } from "./SceneObject.js";
import { Orientation, TilePos, TilePosRecipe } from "@atbs/maths";
import type { Side } from "./Side.js";

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
    private readonly _recipe: UnitRecipe;
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

    constructor(recipe: UnitRecipe, overrides: UnitOverrides, additionalData: UnitAdditionalData) {
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
