import {
    Description,
    Explosion,
    FireMode,
    FireModes,
    FireSelector,
    InstanceId,
    FireModeItemSummary,
    ItemId,
    ItemSummary,
    ItemType,
    Quantity,
    RenderList,
    UnitType,
    Weight,
    RenderMode,
    SightType,
    FireType
} from "@atbs/shared-data";
import { SceneContext, SceneObject } from "./SceneObject.js";
import { degreesToRadians, TilePos } from "@atbs/maths";
import { ItemManager } from "./ItemManager.js";
import { unsafeEntries } from "@atbs/misc";
import { SlotProps, ItemOverrides, ItemRecipe, SlotType, ProjectileRecipe } from "./ItemRecipe.js";
import type { Unit } from "./Unit.js";
import cloneDeep from "lodash/cloneDeep.js";
import { config } from "../config/config.schema.js";

export interface ItemAdditionalData {
    instanceIndex: number;
}

export class Item extends SceneObject {
    private readonly _id: ItemId;
    private readonly _recipe: Readonly<ItemRecipe>;
    private readonly _itemManager: ItemManager;
    private readonly _slots: Map<SlotType, Item>;

    private _location: TilePos | null;
    private _quantity;
    private _fireSelector: FireSelector | null;

    constructor(
        recipe: ItemRecipe,
        overrides: Readonly<ItemOverrides>,
        additionalData: Readonly<ItemAdditionalData>,
        itemManager: ItemManager
    ) {
        super(recipe.renderable);

        this._id = `${recipe.id}-${additionalData.instanceIndex}`;
        this._recipe = recipe;
        this._itemManager = itemManager;

        this._location = overrides.location ? new TilePos(overrides.location) : null;
        this._quantity = overrides.quantity ?? recipe.quantity;
        this._fireSelector = recipe.type === ItemType.enum.gun ? recipe.fireSelector : null;

        this._slots = new Map<SlotType, Item>();
        const { slots } = recipe;
        if (slots) {
            for (const [slotType, { id, quantity }] of unsafeEntries(slots)) {
                const slotItem = itemManager.newItem(id, { quantity });

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

    get shortName(): string {
        return this._recipe.shortName ?? this.name;
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
        // Has fire modes or at least one sub-item in a weapon slot.
        return "fireModes" in this._recipe || this.hasSlot(SlotType.enum[0]);
    }

    get getFireables(): Item[] {
        return this.subItems.filter((item) => item.canFire);
    }

    get willExplode(): boolean {
        return "explosion" in this._recipe && !!this._recipe.explosion;
    }

    get getExplosion(): Explosion {
        if (!("explosion" in this._recipe && !!this._recipe.explosion)) {
            throw new Error(`${this.id} does not have an explosion`);
        }

        return this._recipe.explosion;
    }

    get subItems(): Item[] {
        return Array.from(this._slots.values());
    }

    get allItems(): Item[] {
        const allItems: Item[] = [this];

        return this.subItems.reduce((subItems, item) => {
            subItems.push(...item.allItems);
            return subItems;
        }, allItems);
    }

    get compatibleAmmoIds(): ItemId[] {
        const ammoSlotType = this.findSlotProps(SlotType.enum.ammo);

        return ammoSlotType ? ammoSlotType.compatibleIds : [];
    }

    get maxRange(): number {
        return "projectile" in this._recipe ? this._recipe.projectile.maxRange : 0;
    }

    get spreadAngleInRadians(): number {
        return "spreadAngle" in this._recipe ? degreesToRadians(this._recipe.spreadAngle) : 0;
    }

    get capacity(): number {
        return this.findSlotContents(SlotType.enum.ammo)?.quantity ?? 0;
    }

    get maxCapacity(): number {
        return this.findSlotProps(SlotType.enum.ammo)?.maxQuantity ?? 0;
    }

    get canCollapse(): boolean {
        return this.type === ItemType.enum.round;
    }

    get loadedMagazine(): Item | null {
        const item = this.findSlotContents(SlotType.enum.ammo);

        return item?.type === ItemType.enum.magazine ? item : null;
    }

    get loadedRound(): Item | null {
        const item = this.findSlotContents(SlotType.enum.ammo);
        const subItem = item?.findSlotContents(SlotType.enum.ammo);

        return subItem ?? item ?? null;
    }

    get fireSelector(): FireSelector {
        if (!this._fireSelector) {
            throw new Error(`Item ${this.id} does not have a fire selector`);
        }

        return this._fireSelector;
    }

    set fireSelector(value: FireSelector) {
        if (!this._fireSelector) {
            throw new Error(`Item ${this.id} does not have a fire selector`);
        }

        this._fireSelector = value;
    }

    get sight(): SightType {
        if ("sight" in this._recipe) {
            return this._recipe.sight;
        } else {
            return SightType.enum.iron;
        }
    }

    get fireType(): FireType {
        if (!("fireType" in this._recipe)) {
            throw new Error(`Item ${this.id} does not have a fire type`);
        }

        return this._recipe.fireType;
    }

    get isEmpty(): boolean {
        return this.capacity === 0;
    }

    get projectileRecipe(): ProjectileRecipe {
        if (!("projectile" in this._recipe)) {
            throw new Error(`Item ${this.id} is does not have a projectile`);
        }

        return this._recipe.projectile;
    }

    hasSlot(slot: SlotType): boolean {
        return !!this.findSlotContents(slot);
    }

    findSlotContents(slot: SlotType): Item | undefined {
        return this._slots.get(slot);
    }

    getSlotContents(slot: SlotType): Item {
        const item = this.findSlotContents(slot);
        if (!item) {
            throw new Error(`Unable to find a slot for ${slot}`);
        }
        return item;
    }

    emptySlot(slot: SlotType): void {
        this._slots.delete(slot);
    }

    setSlotContents(slot: SlotType, item: Item): void {
        this._slots.set(slot, item);
    }

    findByItemId(id: ItemId): Item | undefined {
        if (this.id === id) {
            return this;
        }

        return Array.from(this._slots.values()).find((slotItem) => slotItem.id === id);
    }

    getByItemId(id: ItemId): Item {
        const item = this.findByItemId(id);
        if (!item) {
            throw new Error(`Item ${this.id} did not have a sub-item with id ${id}`);
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

    canLoad(): boolean {
        return this.hasSlotProps(SlotType.enum.ammo);
    }

    /**
     * Attempts to load the given ammunition into the gun
     * @param ammo Item to use as ammunition.
     * @returns The existing magazine (if applicable) or what remains in of the passed ammo.
     */
    load(ammo: Item): Item | null {
        if (!this.canLoad) {
            throw new Error(`Item ${this.id} cannot be loaded`);
        }

        if (ammo.type !== ItemType.enum.magazine && ammo.type !== ItemType.enum.round) {
            throw new Error(`Cannot load item ${this.id} with item ${ammo.id}, type ${ammo.type}`);
        }

        const ammoRecipeId = ammo.recipeId;
        const slotProps = this.getSlotProps(SlotType.enum.ammo);
        if (!slotProps.compatibleIds.includes(ammoRecipeId)) {
            throw new Error(
                `${ammo.id} is not a compatible ammo for ${this.id}, only: ${slotProps.compatibleIds.join(", ")} are`
            );
        }

        if (ammo.type === ItemType.enum.magazine) {
            //
            // Magazines
            //
            const existingMagazine = this.getSlotContents(SlotType.enum.ammo);

            this.setSlotContents(SlotType.enum.ammo, ammo);

            return existingMagazine;
        } else {
            //
            // Rounds
            //
            const { maxQuantity } = slotProps;

            let itemsRounds = this.getSlotContents(SlotType.enum.ammo);
            let spaceForRounds: number;

            if (itemsRounds) {
                if (itemsRounds.recipeId !== ammo.recipeId) {
                    throw new Error(
                        `Cannot load ${ammo.id} into ${this.id} as item already contains ${itemsRounds.quantity}x ${itemsRounds.recipeId}`
                    );
                }

                spaceForRounds = maxQuantity - itemsRounds.quantity;
            } else {
                itemsRounds = this._itemManager.newItem(ammo.recipeId, { quantity: 0 });
                spaceForRounds = maxQuantity;
            }
            if (spaceForRounds <= 0) {
                throw new Error(`${this.id} is already fully loaded`);
            }

            const roundsThatCanBeLoaded = Math.min(spaceForRounds, ammo.quantity);

            itemsRounds.quantity += roundsThatCanBeLoaded;
            ammo.quantity -= roundsThatCanBeLoaded;

            return ammo.quantity > 0 ? ammo : null;
        }
    }

    /**
     * Unloads any ammunition from the item
     * @returns The unloaded ammo, if any.
     */
    unload(): Item | null {
        if (!this.canLoad) {
            throw new Error(`Item ${this.id} cannot be loaded`);
        }

        const ammo = this.getSlotContents(SlotType.enum.ammo);
        if (!ammo) {
            return null;
        }

        this.emptySlot(SlotType.enum.ammo);

        return ammo;
    }

    calcDamage(unitType: UnitType): number {
        if (!("projectile" in this._recipe)) {
            return 0;
        }

        const { damage: damageMap } = this._recipe.projectile;
        const damage = unitType in damageMap ? damageMap[unitType] : undefined;
        return damage ?? damageMap.default;
    }

    getRenderList(context: SceneContext): RenderList {
        const unitContext = { ...context, states: [] };

        return super.getRenderList(unitContext);
    }

    getWeapons(): Item[] {
        if (this.hasSlot(SlotType.enum[0])) {
            if (this.hasSlot(SlotType.enum[1])) {
                return [
                    this.getSlotContents(SlotType.enum[0]),
                    this.getSlotContents(SlotType.enum[1])
                ];
            } else {
                return [this.getSlotContents(SlotType.enum[0])];
            }
        }

        return [];
    }

    getFireModes(unit: Unit): FireModes {
        if (this._recipe.type !== ItemType.enum.gun) {
            throw new Error(`Item ${this.id} does not have any fire modes`);
        }

        const fireModes = cloneDeep(this._recipe.fireModes);

        if (FireSelector.enum.single in fireModes) {
            // TODO: I don't like the '!', but how do I make this property not-required as a key AND not set to an undefined value?
            const { fireModeDetails } = fireModes[FireSelector.enum.single]!;

            fireModeDetails[FireMode.enum.aimed].accuracy = unit.calcWeaponAccuracy(
                fireModeDetails[FireMode.enum.aimed].accuracy
            );
            fireModeDetails[FireMode.enum.snapshot].accuracy = unit.calcWeaponAccuracy(
                fireModeDetails[FireMode.enum.snapshot].accuracy
            );
        }

        if (FireSelector.enum.burst in fireModes) {
            // TODO: I don't like the '!', but how do I make this property not-required as a key AND not set to an undefined value?
            const { fireModeDetails } = fireModes[FireSelector.enum.burst]!;

            fireModeDetails[FireMode.enum.aimed].accuracy = unit.calcWeaponAccuracy(
                fireModeDetails[FireMode.enum.aimed].accuracy
            );
            fireModeDetails[FireMode.enum.snapshot].accuracy = unit.calcWeaponAccuracy(
                fireModeDetails[FireMode.enum.snapshot].accuracy
            );
        }

        if (FireSelector.enum.auto in fireModes) {
            // TODO: I don't like the '!', but how do I make this property not-required as a key AND not set to an undefined value?
            const { fireModeDetails } = fireModes[FireSelector.enum.auto]!;

            fireModeDetails[FireMode.enum.aimed].accuracy = unit.calcWeaponAccuracy(
                fireModeDetails[FireMode.enum.aimed].accuracy
            );
            fireModeDetails[FireMode.enum.snapshot].accuracy = unit.calcWeaponAccuracy(
                fireModeDetails[FireMode.enum.snapshot].accuracy
            );
        }

        console.info({ id: this.id, fireModes: this._recipe.fireModes });

        return fireModes;
    }

    fire(): Item {
        if (this.type !== ItemType.enum.gun) {
            throw new Error(`Item ${this.id} cannot be fired, because its it not a gun`);
        }

        const { loadedRound } = this;
        if (!loadedRound) {
            throw new Error(`Item ${this.id} does not have a loaded round to fire`);
        }

        if (!config.infiniteAmmunition) {
            --loadedRound.quantity;
        }

        if (loadedRound.quantity === 0) {
            (this.loadedMagazine ?? this).emptySlot(SlotType.enum.ammo);
        }

        return loadedRound;
    }

    getItemSummary(unit: Unit): ItemSummary {
        return {
            id: this.id,
            name: this.name,
            shortName: this.shortName,
            description: this.description,
            quantity: this.quantity,
            weight: this.weight,
            maxThrowRange: unit.calcThrowMaxRange(this),
            uiImage: this.getRenderList({
                renderMode: RenderMode.enum.UI_MODE,
                states: []
            })
        };
    }

    getFireModeItemSummary(unit: Unit): FireModeItemSummary {
        if (this.type === ItemType.enum.gun) {
            const { loadedMagazine } = this;
            const { loadedRound } = this;

            return {
                ...this.getItemSummary(unit),
                weapons: [
                    {
                        id: this.id,
                        name: this.name,
                        shortName: this.shortName,
                        description: this.description,
                        capacity: (loadedMagazine ?? this).capacity,
                        maxCapacity: (loadedMagazine ?? this).maxCapacity,
                        sight: this.sight,
                        maxRange: loadedRound?.maxRange,
                        fireSelector: this.fireSelector,
                        fireModes: this.getFireModes(unit),
                        loadedRound: loadedRound?.name,
                        uiImage: this.getRenderList({
                            renderMode: RenderMode.enum.UI_MODE,
                            states: []
                        })
                    }
                ]
            };
        }

        return {
            ...this.getItemSummary(unit),
            weapons: this.getWeapons().map((weapon) => {
                const { loadedMagazine } = weapon;
                const { loadedRound } = weapon;

                return {
                    id: weapon.id,
                    name: weapon.name,
                    shortName: weapon.shortName,
                    description: weapon.description,
                    capacity: (loadedMagazine ?? weapon).capacity,
                    maxCapacity: (loadedMagazine ?? weapon).maxCapacity,
                    fireSelector: weapon.fireSelector,
                    fireModes: weapon.getFireModes(unit),
                    loadedRound: loadedRound?.name,
                    sight: weapon.sight,
                    uiImage: weapon.getRenderList({
                        renderMode: RenderMode.enum.UI_MODE,
                        states: []
                    })
                };
            })
        };
    }
}
