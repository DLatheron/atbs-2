import {
    Description,
    Explosion,
    InstanceId,
    ItemId,
    ItemType,
    Quantity,
    RenderList,
    Weight
} from "@atbs/shared-data";
import { SceneContext, SceneObject } from "./SceneObject.js";
import { TilePos } from "@atbs/maths";
import { ItemManager } from "./ItemManager.js";
import { unsafeEntries } from "@atbs/misc";
import { SlotProps, ItemOverrides, ItemRecipe, SlotType } from "./ItemRecipe.js";

export interface ItemAdditionalData {
    instanceIndex: number;
}

export class Item extends SceneObject {
    private readonly _id: ItemId;
    private readonly _recipe: Readonly<ItemRecipe>;
    private readonly _slots: Map<SlotType, Item>;

    private _location: TilePos | null;
    private _quantity;

    constructor(
        recipe: ItemRecipe,
        overrides: Readonly<ItemOverrides>,
        additionalData: Readonly<ItemAdditionalData>,
        itemManager: ItemManager
    ) {
        super(recipe.renderable);

        this._id = `${recipe.id}-${additionalData.instanceIndex}`;
        this._recipe = recipe;

        this._location = overrides.location ? new TilePos(overrides.location) : null;
        this._quantity = overrides.quantity ?? recipe.quantity;

        this._slots = new Map<SlotType, Item>();
        const { slots } = recipe;
        if (slots) {
            for (const [slotType, { id, quantity }] of unsafeEntries(slots)) {
                const slotItem = itemManager.createItem(id, { quantity });

                this._slots.set(slotType, slotItem);
            }
        }
    }

    get id(): InstanceId {
        return this._id;
    }

    get type(): ItemType {
        return this._recipe.type;
    }

    get recipeId(): ItemId {
        return this._recipe.id;
    }

    get name(): string {
        return this._recipe.name;
    }

    get description(): Description {
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

    get quantity(): Quantity {
        return this._quantity;
    }

    set quantity(value: Quantity) {
        this._quantity = value;
    }

    get emptyWeight(): Weight {
        return this._recipe.weight;
    }

    get weight(): Weight {
        return this.allItems.reduce(
            (totalWeight, { emptyWeight, quantity }) => totalWeight + emptyWeight * quantity,
            0.0
        );
    }

    get canFire(): boolean {
        return !!this._recipe.fireModes;
    }

    get getFireables(): Item[] {
        return this.subItems.filter((item) => item.canFire);
    }

    get willExplode(): boolean {
        return !!this._recipe.explosion;
    }

    get getExplosion(): Explosion {
        if (!this._recipe.explosion) {
            throw new Error(`${this.id} does not have an explosion`);
        }

        return this._recipe.explosion;
    }

    get subItems(): Item[] {
        return Array.from(this._slots.values());
    }

    get allItems(): Item[] {
        const subItems = this.subItems;

        return subItems.reduce((subItems, item) => {
            subItems.push(...item.allItems);
            return subItems;
        }, subItems);
    }

    get compatibleAmmoIds(): ItemId[] {
        const ammoSlotType = this.findSlotProps(SlotType.enum.ammo);

        return ammoSlotType ? ammoSlotType.compatibleIds : [];
    }

    hasSlot(slot: SlotType): boolean {
        return !!this.findSlot(slot);
    }

    findSlot(slot: SlotType): Item | undefined {
        return this._slots.get(slot);
    }

    getSlot(slot: SlotType): Item {
        const item = this.findSlot(slot);
        if (!item) {
            throw new Error(`Unable to find a slot for ${slot}`);
        }
        return item;
    }

    hasSlotProps(slot: SlotType): boolean {
        return !!this.findSlotProps(slot);
    }

    findSlotProps(slot: SlotType): SlotProps | undefined {
        return this._recipe.slotProps?.[slot];
    }

    getSlotProps(slot: SlotType): SlotProps {
        const slotProps = this.findSlotProps(slot);
        if (!slotProps) {
            throw new Error(`Unable to find slot props for ${slot}`);
        }
        return slotProps;
    }

    getRenderList(context: SceneContext): RenderList {
        const unitContext = { ...context, states: [] };

        return super.getRenderList(unitContext);
    }
}
