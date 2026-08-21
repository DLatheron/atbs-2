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
    Weight,
    RenderMode,
    SightType,
    FireType,
    SceneObject,
    SceneContext,
    Prime,
    FireModeEx,
    FireModeDetail
} from "@atbs/shared-data";
import { clamp, degreesToRadians, TilePos, Vec2 } from "@atbs/maths";
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
    private _primed: Prime | undefined;

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
        this._primed = undefined;

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

    get throwActionPointCost(): number {
        return Math.floor(clamp(this.weight * 5, 10, 30));
    }

    get suitableForOpportunityFire(): boolean {
        return this.type === ItemType.enum.gun || this.type === ItemType.enum.grenade;
    }

    get primed(): Prime | undefined {
        return this._primed;
    }

    set primed(value: Prime) {
        this._primed = value;
    }

    get isPrimable(): boolean {
        return this.type === ItemType.enum.grenade;
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

        for (const slotItem of this._slots.values()) {
            const nested = slotItem.findByItemId(id);
            if (nested) {
                return nested;
            }
        }
    }

    /** The item that directly holds `contentsId` in one of its slots. */
    findOwnerOfContents(contentsId: ItemId): Item | undefined {
        for (const child of this._slots.values()) {
            if (child.id === contentsId) {
                return this;
            }
            const nested = child.findOwnerOfContents(contentsId);
            if (nested) {
                return nested;
            }
        }
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
     * Magazines and single-round chambers (e.g. M203) replace the whole slot item.
     * Stackable round wells (magazines) top up quantity instead.
     */
    replacesAmmoAsWholeItem(ammo: Item): boolean {
        if (ammo.type === ItemType.enum.magazine) {
            return true;
        }

        // Capacity-1 chambers always swap the chambered item, even when taking
        // one round from a larger inventory stack.
        return ammo.type === ItemType.enum.round && this.maxCapacity === 1;
    }

    /**
     * Attempts to load the given ammunition into the gun
     * @param ammo Item to use as ammunition.
     * @returns The existing magazine/round (if applicable) or what remains of the passed ammo.
     */
    load(ammo: Item): Item | null {
        if (!this.canLoad()) {
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

        if (this.replacesAmmoAsWholeItem(ammo)) {
            const existing = this.findSlotContents(SlotType.enum.ammo) ?? null;
            let toChamber = ammo;
            if (ammo.type === ItemType.enum.round && ammo.quantity > 1) {
                toChamber = this._itemManager.newItem(ammo.recipeId, { quantity: 1 });
                ammo.quantity -= 1;
            }
            this.setSlotContents(SlotType.enum.ammo, toChamber);
            return existing;
        }

        const { maxQuantity } = slotProps;

        let itemsRounds = this.findSlotContents(SlotType.enum.ammo);
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
            this.setSlotContents(SlotType.enum.ammo, itemsRounds);
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

    /**
     * Unloads any ammunition from the item
     * @returns The unloaded ammo, if any.
     */
    unload(): Item | null {
        if (!this.canLoad()) {
            throw new Error(`Item ${this.id} cannot be loaded`);
        }

        const ammo = this.findSlotContents(SlotType.enum.ammo);
        if (!ammo) {
            return null;
        }

        this.emptySlot(SlotType.enum.ammo);

        return ammo;
    }

    getRenderList(context: SceneContext): RenderList {
        const unitContext = { ...context, states: [], visibilityFilter: true };

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
        const { actionPoints } = unit;

        const applyUnitFireModeDetails = (fireModeDetails: Record<FireMode, FireModeDetail>) => {
            fireModeDetails[FireMode.enum.aimed].accuracy = unit.calcWeaponAccuracy(
                fireModeDetails[FireMode.enum.aimed].accuracy
            );
            fireModeDetails[FireMode.enum.snapshot].accuracy = unit.calcWeaponAccuracy(
                fireModeDetails[FireMode.enum.snapshot].accuracy
            );
            fireModeDetails[FireMode.enum.aimed].available =
                actionPoints >= fireModeDetails[FireMode.enum.aimed].actionPoints;
            fireModeDetails[FireMode.enum.snapshot].available =
                actionPoints >= fireModeDetails[FireMode.enum.snapshot].actionPoints;
        };

        if (FireSelector.enum.single in fireModes) {
            // TODO: I don't like the '!', but how do I make this property not-required as a key AND not set to an undefined value?
            applyUnitFireModeDetails(fireModes[FireSelector.enum.single]!.fireModeDetails);
        }

        if (FireSelector.enum.burst in fireModes) {
            // TODO: I don't like the '!', but how do I make this property not-required as a key AND not set to an undefined value?
            applyUnitFireModeDetails(fireModes[FireSelector.enum.burst]!.fireModeDetails);
        }

        if (FireSelector.enum.auto in fireModes) {
            // TODO: I don't like the '!', but how do I make this property not-required as a key AND not set to an undefined value?
            applyUnitFireModeDetails(fireModes[FireSelector.enum.auto]!.fireModeDetails);
        }

        // console.info({ id: this.id, fireModes: this._recipe.fireModes });

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
            primed: this.isPrimable ? (this.primed ?? "safe") : undefined,
            maxThrowRange: unit.calcThrowMaxRange(this),
            uiImage: this.getRenderList({
                renderMode: RenderMode.enum.UI_MODE,
                states: []
            })
        };
    }

    getFireModeItemSummary(unit: Unit): FireModeItemSummary {
        const fireModeEx = this.canFire ? unit.fireMode : FireModeEx.enum.throw;

        if (this.type === ItemType.enum.gun) {
            const { loadedMagazine } = this;
            const { loadedRound } = this;
            const weapons = [
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
            ];

            return {
                ...this.getItemSummary(unit),
                weapons,
                fireModeEx,
                weaponIndex: Math.min(unit.inventory.weaponIndex, weapons.length - 1)
            };
        }

        const weapons = this.getWeapons().map((weapon) => {
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
        });

        return {
            ...this.getItemSummary(unit),
            weapons,
            fireModeEx,
            weaponIndex:
                weapons.length === 0 ? 0 : Math.min(unit.inventory.weaponIndex, weapons.length - 1)
        };
    }

    static CalcShotAccuracy(accuracy: number, offTargetPower = 2): number {
        const skillThreshold = accuracy / 100;
        const randomValue = Math.random();

        if (randomValue <= skillThreshold) {
            // On target.
            return 0.5;
        } else {
            // Off target.
            const difference = randomValue - skillThreshold;
            const diffPow = 1.0 - Math.pow(1.0 - difference, offTargetPower);
            const randomSign = Math.sign(Math.random() - 0.5);

            return clamp(0.5 + (diffPow / 2) * randomSign, 0, 1);
        }
    }

    static PerturbAccuracy(
        dirVector: Vec2,
        overallAccuracy: number,
        inaccuracyAngle = 10
    ): { dirVector: Vec2; accuracy: number; onTarget: boolean } {
        const accuracy = Item.CalcShotAccuracy(overallAccuracy);
        if (accuracy === 0.5) {
            return { dirVector, accuracy, onTarget: true };
        }

        const inaccuracyHalfAngle = degreesToRadians(inaccuracyAngle / 2);

        const angles = [
            dirVector.rotate(-inaccuracyHalfAngle),
            dirVector.rotate(inaccuracyHalfAngle)
        ];

        return {
            dirVector: Vec2.Slerp(angles[0], angles[1], accuracy),
            accuracy,
            onTarget: false
        };
    }

    static PerturbRange(range: number) {
        // TODO: Implement.

        return range;
    }
}
