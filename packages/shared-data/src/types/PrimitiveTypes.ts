import z from "zod";
import { Phase } from "./Phase.js";
import {
    Colour,
    generateRandomBetween,
    IColour,
    ITilePos,
    IVec2,
    Orientation,
    PathSegment
} from "@atbs/maths";
import { RenderMode } from "./RenderMode.js";

export const MILLISECONDS_IN_A_MINUTE = 60000;

const onTarget = ["none", "onTarget", "offTarget"] as const;
export const OnTarget = z.enum(onTarget);
export type OnTarget = z.infer<typeof OnTarget>;

const unitType = ["human"] as const;
export const UnitType = z.enum(unitType);
export type UnitType = z.infer<typeof UnitType>;

export const ClientId = z.uuid();
export type ClientId = z.infer<typeof ClientId>;

export const GameId = z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
export type GameId = z.infer<typeof GameId>;

export const ScenarioId = z.string().nonempty();
export type ScenarioId = z.infer<typeof ScenarioId>;

export const SideId = z.string().nonempty();
export type SideId = z.infer<typeof SideId>;

export const MapId = z.string().nonempty();
export type MapId = z.infer<typeof MapId>;

export const TerrainId = z.string().nonempty();
export type TerrainId = z.infer<typeof TerrainId>;

export const FurnitureId = z.string().nonempty();
export type FurnitureId = z.infer<typeof FurnitureId>;

export const MaterialId = z.string().nonempty();
export type MaterialId = z.infer<typeof MaterialId>;

export const ObjectId = z.string().nonempty();
export type ObjectId = z.infer<typeof ObjectId>;

export const UnitId = z.string().nonempty();
export type UnitId = z.infer<typeof UnitId>;

export const ViewerId = z.string().nonempty();
export type ViewerId = z.infer<typeof ViewerId>;

export const ItemId = z.string().nonempty();
export type ItemId = z.infer<typeof ItemId>;

export const InstanceId = z.string().nonempty();
export type InstanceId = z.infer<typeof InstanceId>;

export const ImageId = z.string().nonempty();
export type ImageId = z.infer<typeof ImageId>;

export const Weight = z.number().nonnegative();
export type Weight = z.infer<typeof Weight>;

export const Quantity = z.int().positive();
export type Quantity = z.infer<typeof Quantity>;

export const DescriptionH1 = z.object({ h1: z.string() });
export type DescriptionH1 = z.infer<typeof DescriptionH1>;

export const DescriptionH2 = z.object({ h2: z.string() });
export type DescriptionH2 = z.infer<typeof DescriptionH2>;

export const DescriptionH3 = z.object({ h3: z.string() });
export type DescriptionH3 = z.infer<typeof DescriptionH3>;

export const DescriptionText = z.object({ text: z.string(), pb: z.number().optional() });
export type DescriptionText = z.infer<typeof DescriptionText>;

export const DescriptionLine = z.object({ line: z.boolean() });
export type DescriptionLine = z.infer<typeof DescriptionLine>;

export const furnitureState = ["default", "destroyed", "open", "closed", "locked"] as const;
export const FurnitureState = z.enum(furnitureState);
export type FurnitureState = z.infer<typeof FurnitureState>;

export const RGBColor = z.object({
    r: z.number().min(0).max(255),
    g: z.number().min(0).max(255),
    b: z.number().min(0).max(255)
});
export type RGBColor = z.infer<typeof RGBColor>;

export const HSLColor = z.object({
    h: z.number().min(0).max(255),
    s: z.number().min(0).max(255),
    l: z.number().min(0).max(255)
});
export type HSLColor = z.infer<typeof HSLColor>;

export const MovementObstruction = z
    .partialRecord(UnitType.or(z.literal("default")), z.number().nonnegative())
    .and(z.object({ default: z.number().nonnegative() }));
export type MovementObstruction = z.infer<typeof MovementObstruction>;

export const FurnitureStateMovementObstructionMap = z
    .partialRecord(FurnitureState, MovementObstruction)
    .and(z.object({ default: MovementObstruction }));
export type FurnitureStateMovementObstructionMap = z.infer<
    typeof FurnitureStateMovementObstructionMap
>;

const attributeTypes = [
    "actionPoints",
    "constitution",
    "fitness",
    "morale",
    "stamina",
    "speed",
    "strength"
] as const;
export const AttributeTypes = z.enum(attributeTypes);
export type AttributeTypes = z.infer<typeof AttributeTypes>;

export const materialTransition = ["enter", "exit", "transition"] as const;
export const MaterialTransition = z.enum(materialTransition);
export type MaterialTransition = z.infer<typeof MaterialTransition>;

export const VisualType = z.enum(["eyeball", "infrared"]);
export type VisualType = z.infer<typeof VisualType>;

export const materialDensityType = ["eyeball", "infrared", "projectile"] as const;
export const MaterialDensityType = z.enum(materialDensityType);
export type MaterialDensityType = z.infer<typeof MaterialDensityType>;

export const MaterialDensityMap = z
    .partialRecord(MaterialDensityType.or(z.literal("default")), z.number().positive())
    .and(z.object({ default: z.number().positive() }));
export type MaterialDensityMap = z.infer<typeof MaterialDensityMap>;

export const AttributeDef = z.object({
    max: z.int().nonnegative(),
    value: z.int().nonnegative().optional()
});
export type AttributeDef = z.infer<typeof AttributeDef>;

export const Attribute = z.object({
    max: z.int().nonnegative(),
    value: z.int().nonnegative()
});
export type Attribute = z.infer<typeof Attribute>;

export const RenderImage = z.object({
    imageId: ImageId,
    orientation: z.enum(Orientation).optional(), // Assume NORTH.
    opacity: z.number().optional(), // Assume 1.
    visibilityFilter: z.boolean().optional() // Assume true (always draw).
});
export type RenderImage = z.infer<typeof RenderImage>;

export const RenderList = z.array(RenderImage);
export type RenderList = z.infer<typeof RenderList>;

export function isRenderList(node: unknown): node is RenderList {
    return (
        node === null ||
        node === undefined ||
        (Array.isArray(node) && (node.length === 0 || node.every(isRenderImage)))
    );
}

export const ClientMap = z.object({
    width: z.int().positive(),
    height: z.int().positive(),
    tileSize: z.int().positive(),
    tilesByRenderMode: z.object({
        [RenderMode.enum.MAP_MODE]: z.array(z.array(RenderList)),
        [RenderMode.enum.FIRE_MODE]: z.array(z.array(RenderList))
    })
});
export type ClientMap = z.infer<typeof ClientMap>;

export function isRenderImage(node: unknown): node is RenderImage {
    return node === null || node === undefined || (typeof node === "object" && "imageId" in node);
}

export const RenderListByMode = z.record(RenderMode, RenderList);
export type RenderListByMode = z.infer<typeof RenderListByMode>;

export const DescriptionImage = z.object({
    image: z.string(),
    alt: z.string().optional(),
    width: z.int().positive(),
    height: z.int().positive()
});
export type DescriptionImage = z.infer<typeof DescriptionImage>;

export const Description = z.array(
    z.union([
        DescriptionH1,
        DescriptionH2,
        DescriptionH3,
        DescriptionText,
        DescriptionLine,
        DescriptionImage
    ])
);
export type Description = z.infer<typeof Description>;

export const SideSummary = z.object({
    id: SideId,
    name: z.string(),
    victoryPoints: z.int().min(0)
});
export type SideSummary = z.infer<typeof SideSummary>;

export const ClientSummary = z.object({
    id: ClientId,
    name: z.string()
});
export type ClientSummary = z.infer<typeof ClientSummary>;

export const ScenarioSummary = z.object({
    id: ScenarioId,
    name: z.string().nonempty(),
    description: Description,
    sides: z.array(
        z.object({
            id: SideId,
            name: z.string().nonempty(),
            description: Description
        })
    )
});
export type ScenarioSummary = z.infer<typeof ScenarioSummary>;

export const FurnitureSummary = z.object({
    id: FurnitureId,
    name: z.string().nonempty(),
    description: Description
});
export type FurnitureSummary = z.infer<typeof FurnitureSummary>;

export const TileInfo = z.object({
    tilePos: ITilePos,
    terrain: z.object({
        name: z.string(),
        uiImage: RenderList,
        description: Description
    }),
    furniture: z
        .object({
            name: z.string(),
            uiImage: RenderList,
            description: Description,
            integrity: z.number().min(0).max(100).optional()
        })
        .optional(),
    item: z
        .object({
            name: z.string(),
            uiImage: RenderList,
            description: Description
        })
        .optional(),
    unit: z
        .object({
            name: z.string(),
            uiImage: RenderList,
            description: Description
        })
        .optional(),
    unitUsing: z
        .object({
            name: z.string(),
            uiImage: RenderList,
            description: Description
        })
        .optional()
});
export type TileInfo = z.infer<typeof TileInfo>;

export const WaitingFor = z.object({
    phase: Phase,
    sides: z.array(SideSummary)
});
export type WaitingFor = z.infer<typeof WaitingFor>;

const errorType = [
    "INSUFFICIENT_ACTION_POINTS",
    "INSUFFICIENT_AMMO",
    "UNABLE_TO_MOVE_THERE"
] as const;

export const ErrorType = z.enum(errorType);
export type ErrorType = z.infer<typeof ErrorType>;

const distribution = ["linear"] as const;
export const Distribution = z.enum(distribution);
export type Distribution = z.infer<typeof Distribution>;

export const JitteredValue = z.union([
    z.number().positive(),
    z
        .object({
            min: z.number().positive(),
            max: z.number().positive(),
            distribution: z.literal(Distribution.enum.linear).optional()
        })
        .refine(({ min, max }) => min < max)
]);
export type JitteredValue = z.infer<typeof JitteredValue>;

export function resolveJitteredValue(value: JitteredValue) {
    if (typeof value === "number") {
        return value;
    }

    switch (value.distribution) {
        case Distribution.enum.linear:
        case undefined:
            return generateRandomBetween(value.min, value.max);

        default:
            throw new Error(`Unexpected distribution: ${value.distribution}`);
    }
}

const damageType = ["default", "disorientation"] as const;
export const DamageType = z.enum(damageType);
export type DamageType = z.infer<typeof DamageType>;

export const DamageMap = z
    .partialRecord(UnitType.or(z.literal("default")), z.number().nonnegative())
    .and(
        z.object({
            type: DamageType.default(DamageType.enum.default),
            default: z.number().nonnegative()
        })
    );
export type DamageMap = z.infer<typeof DamageMap>;

const itemType = ["item", "gun", "magazine", "round", "grenade"] as const;
export const ItemType = z.enum(itemType);
export type ItemType = z.infer<typeof ItemType>;

const explosionType = ["fragment", "gas", "smoke", "shockwave"] as const;
export const ExplosionType = z.enum(explosionType);
export type ExplosionType = z.infer<typeof ExplosionType>;

const fireType = ["direct", "indirect"] as const;
export const FireType = z.enum(fireType);
export type FireType = z.infer<typeof FireType>;

const sightType = ["iron", "optical", "laser", "ranged"] as const;
export const SightType = z.enum(sightType);
export type SightType = z.infer<typeof SightType>;

const fireSelector = ["single", "burst", "auto"] as const;
export const FireSelector = z.enum(fireSelector);
export type FireSelector = z.infer<typeof FireSelector>;

const fireMode = ["aimed", "snapshot"] as const;
export const FireMode = z.enum(fireMode);
export type FireMode = z.infer<typeof FireMode>;

const fireModeEx = ["none", ...fireMode, "throw"] as const;
export const FireModeEx = z.enum(fireModeEx);
export type FireModeEx = z.infer<typeof FireModeEx>;

export const FireModeDetail = z.object({
    accuracy: z.number().min(0).max(100),
    actionPoints: z.int().positive()
});
export type FireModeDetail = z.infer<typeof FireModeDetail>;

export const FireModeExtendedDetail = FireModeDetail.extend({
    actionPointsPerRound: z.int().positive()
});
export type FireModeExtendedDetail = z.infer<typeof FireModeExtendedDetail>;

export const FireModeDetails = z.record(FireMode, FireModeDetail);
export type FireModeDetails = z.infer<typeof FireModeDetails>;

export const FireModeExtendedDetails = z.record(FireMode, FireModeExtendedDetail);
export type FireModeExtendedDetails = z.infer<typeof FireModeExtendedDetails>;

export const FireModeSingle = z.object({
    ammoUse: z.int().positive(),
    fireModeDetails: FireModeDetails
});
export type FireModeSingle = z.infer<typeof FireModeSingle>;

export const FireModeBurst = z.object({
    ammoUse: z.int().positive(),
    rpm: z.int().positive(),
    fireModeDetails: FireModeDetails
});
export type FireModeBurst = z.infer<typeof FireModeBurst>;

export const FireModeAuto = z.object({
    rpm: z.int().positive(),
    fireModeDetails: FireModeExtendedDetails
});
export type FireModeAuto = z.infer<typeof FireModeAuto>;

// This is horrible, but seems to be the only way to build such a scheme 🤷‍♂️
export const FireModes = z.union([
    z.object({
        [FireSelector.enum.single]: FireModeSingle,
        [FireSelector.enum.burst]: FireModeBurst,
        [FireSelector.enum.auto]: FireModeAuto
    }),
    z.object({
        [FireSelector.enum.single]: FireModeSingle,
        [FireSelector.enum.burst]: FireModeBurst
    }),
    z.object({
        [FireSelector.enum.single]: FireModeSingle,
        [FireSelector.enum.auto]: FireModeAuto
    }),
    z.object({ [FireSelector.enum.burst]: FireModeBurst, [FireSelector.enum.auto]: FireModeAuto }),
    z.object({ [FireSelector.enum.single]: FireModeSingle }),
    z.object({ [FireSelector.enum.burst]: FireModeBurst }),
    z.object({ [FireSelector.enum.auto]: FireModeAuto })
]);
export type FireModes = z.infer<typeof FireModes>;

export function isFireModeSingle(fireMode: unknown): fireMode is FireModeSingle {
    return FireModeSingle.safeParse(fireMode).success;
}

export function isFireModeBurst(fireMode: unknown): fireMode is FireModeBurst {
    return FireModeBurst.safeParse(fireMode).success;
}

export function isFireModeAuto(fireMode: unknown): fireMode is FireModeAuto {
    return FireModeAuto.safeParse(fireMode).success;
}

export function getRpm(fireModes: FireModes, fireSelector: FireSelector): number {
    switch (fireSelector) {
        case FireSelector.enum.single:
            if (FireSelector.enum.single in fireModes) {
                return 0;
            }
            break;

        case FireSelector.enum.burst:
            if (FireSelector.enum.burst in fireModes) {
                return fireModes[FireSelector.enum.burst].rpm;
            }
            break;

        case FireSelector.enum.auto:
            if (FireSelector.enum.auto in fireModes) {
                return fireModes[FireSelector.enum.auto].rpm;
            }
            break;
    }

    throw new Error(`${fireSelector} not supported by ${fireModes}`);
}

export function getAccuracy(
    fireModes: FireModes,
    fireSelector: FireSelector,
    fireMode: FireMode
): number {
    switch (fireSelector) {
        case FireSelector.enum.single:
            if (FireSelector.enum.single in fireModes) {
                return fireModes[fireSelector].fireModeDetails[fireMode].accuracy;
            }
            break;

        case FireSelector.enum.burst:
            if (FireSelector.enum.burst in fireModes) {
                return fireModes[fireSelector].fireModeDetails[fireMode].accuracy;
            }
            break;

        case FireSelector.enum.auto:
            if (FireSelector.enum.auto in fireModes) {
                return fireModes[fireSelector].fireModeDetails[fireMode].accuracy;
            }
            break;
    }

    throw new Error(`${fireSelector} not supported by ${fireModes}`);
}

export function shotsFired(timeDeltaInMS: number, rpm: number) {
    return Math.max(Math.floor((timeDeltaInMS * rpm) / MILLISECONDS_IN_A_MINUTE), 1);
}

export function getSingleFireMode(fireModes: FireModes): FireModeSingle {
    if (!(FireSelector.enum.single in fireModes)) {
        throw new Error(`Single mode is not supported, only: ${Object.keys(fireModes).join("|")}`);
    }

    return fireModes[FireSelector.enum.single];
}

export function getBurstFireMode(fireModes: FireModes): FireModeBurst {
    if (!(FireSelector.enum.burst in fireModes)) {
        throw new Error(`Burst mode is not supported, only: ${Object.keys(fireModes).join("|")}`);
    }

    return fireModes[FireSelector.enum.burst];
}

export function getAutoFireMode(fireModes: FireModes): FireModeAuto {
    if (!(FireSelector.enum.auto in fireModes)) {
        throw new Error(`Auto mode is not supported, only: ${Object.keys(fireModes).join("|")}`);
    }

    return fireModes[FireSelector.enum.auto];
}

export function calcFireActionPointCost(
    fireModes: FireModes,
    fireSelector: FireSelector,
    fireMode: FireMode
): { initialAptCost: number; perShotAptCost: number } {
    switch (fireSelector) {
        case FireSelector.enum.single:
            if (FireSelector.enum.single in fireModes) {
                return {
                    initialAptCost:
                        fireModes[FireSelector.enum.single].fireModeDetails[fireMode].actionPoints,
                    perShotAptCost: 0
                };
            }
            break;

        case FireSelector.enum.burst:
            if (FireSelector.enum.burst in fireModes) {
                return {
                    initialAptCost:
                        fireModes[FireSelector.enum.burst].fireModeDetails[fireMode].actionPoints,
                    perShotAptCost: 0
                };
            }
            break;

        case FireSelector.enum.auto:
            if (FireSelector.enum.auto in fireModes) {
                return {
                    initialAptCost:
                        fireModes[FireSelector.enum.auto].fireModeDetails[fireMode].actionPoints,
                    perShotAptCost:
                        fireModes[FireSelector.enum.auto].fireModeDetails[fireMode]
                            .actionPointsPerRound
                };
            }
            break;
    }

    throw new Error(`${fireSelector} not supported by ${fireModes}`);
}

export function calcMinimumAmmoUse(fireModes: FireModes, fireSelector: FireSelector): number {
    switch (fireSelector) {
        case FireSelector.enum.single:
            if (FireSelector.enum.single in fireModes) {
                return 1;
            }
            break;

        case FireSelector.enum.burst:
            if (FireSelector.enum.burst in fireModes) {
                return fireModes[FireSelector.enum.burst].ammoUse;
            }
            break;

        case FireSelector.enum.auto:
            if (FireSelector.enum.auto in fireModes) {
                return 0;
            }
            break;
    }

    throw new Error(`${fireSelector} not supported by ${fireModes}`);
}

export function calcAmmoUse(
    fireModes: FireModes,
    fireSelector: FireSelector,
    triggerHeldTimeInMs: number = 0
): number {
    switch (fireSelector) {
        case FireSelector.enum.single:
            if (FireSelector.enum.single in fireModes) {
                return 1;
            }
            break;

        case FireSelector.enum.burst:
            if (FireSelector.enum.burst in fireModes) {
                return fireModes[FireSelector.enum.burst].ammoUse;
            }
            break;

        case FireSelector.enum.auto:
            if (FireSelector.enum.auto in fireModes) {
                return shotsFired(triggerHeldTimeInMs, fireModes[FireSelector.enum.auto].rpm);
            }
            break;
    }

    throw new Error(`${fireSelector} not supported by ${fireModes}`);
}

const action = ["throw"] as const;
export const Action = z.enum(action);
export type Action = z.infer<typeof Action>;

export const Actions = z.union([
    z.object({
        [Action.enum.throw]: FireModeDetail.extend({
            available: z.boolean().optional().default(true)
        })
    }),
    z.object({})
]);
export type Actions = z.infer<typeof Actions>;

export const FragmentExplosion = z.object({
    type: z.literal(ExplosionType.enum.fragment),
    maxRange: JitteredValue,
    numFragments: JitteredValue,
    damage: DamageMap
    // TODO: Other properties...
});
export type FragmentExplosion = z.infer<typeof FragmentExplosion>;

export const SmokeExplosion = z.object({
    type: z.literal(ExplosionType.enum.gas),
    particles: z.array(JitteredValue)
    // TODO: Other properties.
});
export type SmokeExplosion = z.infer<typeof SmokeExplosion>;

export const GasExplosion = z.object({
    type: z.literal(ExplosionType.enum.smoke),
    particles: z.array(JitteredValue)
    // TODO: Other properties.
});
export type GasExplosion = z.infer<typeof GasExplosion>;

export const ShockwaveExplosion = z.object({
    type: z.literal(ExplosionType.enum.shockwave)
    // TODO: Other properties.
});
export type ShockwaveExplosion = z.infer<typeof ShockwaveExplosion>;

export const Explosion = z.discriminatedUnion("type", [
    FragmentExplosion,
    SmokeExplosion,
    GasExplosion,
    ShockwaveExplosion
]);
export type Explosion = z.infer<typeof Explosion>;

export const ItemSummary = z.object({
    id: ItemId,
    name: z.string(),
    shortName: z.string(),
    description: Description,
    quantity: Quantity,
    weight: Weight,
    maxThrowRange: z.number().nonnegative(),
    uiImage: RenderList
});
export type ItemSummary = z.infer<typeof ItemSummary>;

/**
 * A friendly viewer's cone parameters for client-side fog / view-cone rendering.
 * Sent alongside the side's visible tile set whenever visibility changes.
 */
export const VisibilityViewerSummary = z.object({
    location: ITilePos,
    orientation: z.enum(Orientation),
    viewAngleInDegrees: z.number().positive(),
    viewRange: z.number().nonnegative()
});
export type VisibilityViewerSummary = z.infer<typeof VisibilityViewerSummary>;

export const VisibilityUpdate = z.object({
    tiles: z.array(z.string().describe("Tile position as a string")),
    viewers: z.array(VisibilityViewerSummary)
});
export type VisibilityUpdate = z.infer<typeof VisibilityUpdate>;

export const FireModeWeaponSummary = z.object({
    id: ItemId,
    name: z.string(),
    shortName: z.string(),
    description: Description,
    capacity: z.int().nonnegative(),
    maxCapacity: z.int().nonnegative(),
    loadedRound: z.string().optional(),
    sight: SightType,
    maxRange: z.number().optional(),
    fireSelector: FireSelector,
    fireModes: FireModes,
    uiImage: RenderList
});
export type FireModeWeaponSummary = z.infer<typeof FireModeWeaponSummary>;

export const FireModeItemSummary = ItemSummary.extend({
    weapons: z.array(FireModeWeaponSummary)
});
export type FireModeItemSummary = z.infer<typeof FireModeItemSummary>;

/** Matches server `SlotType` in ItemRecipe (`"0" | "1" | "ammo"`). */
const inventorySlotType = ["0", "1", "ammo"] as const;
export const InventorySlotType = z.enum(inventorySlotType);
export type InventorySlotType = z.infer<typeof InventorySlotType>;

// Recursive types: written by hand to break the inference cycle.
export type InventoryItemView = ItemSummary & {
    type: ItemType;
    slots: Array<{
        slot: InventorySlotType;
        compatibleIds: ItemId[];
        maxQuantity: Quantity;
        contents: InventoryItemView | null;
    }>;
};

export const InventoryItemView: z.ZodType<InventoryItemView> = ItemSummary.extend({
    type: ItemType,
    slots: z.array(
        z.object({
            slot: InventorySlotType,
            compatibleIds: z.array(ItemId),
            maxQuantity: Quantity,
            contents: z.lazy(() => InventoryItemView).nullable()
        })
    )
});

export const InventoryCosts = z.object({
    use: z.int().nonnegative(),
    unuse: z.int().nonnegative(),
    drop: z.int().nonnegative(),
    pickup: z.int().nonnegative(),
    pickupAndUse: z.int().nonnegative(),
    load: z.int().nonnegative(),
    loadFromGround: z.int().nonnegative(),
    unload: z.int().nonnegative()
});
export type InventoryCosts = z.infer<typeof InventoryCosts>;

export const InventorySnapshot = z.object({
    unitId: UnitId,
    actionPoints: Attribute,
    costs: InventoryCosts,
    inUseItemId: InstanceId.nullable(),
    items: z.array(InventoryItemView),
    groundItems: z.array(InventoryItemView)
});
export type InventorySnapshot = z.infer<typeof InventorySnapshot>;

export const FireDetails = z.object({
    unitId: UnitId,
    weaponId: ItemId,
    fireSelector: FireSelector,
    fireMode: FireMode,
    worldPoses: z.array(IVec2),
    triggerHeldTimeInMs: z.number().nonnegative()
});
export type FireDetails = z.infer<typeof FireDetails>;

export const ThrowDetails = z.object({
    unitId: UnitId,
    itemId: ItemId,
    worldPos: IVec2
});
export type ThrowDetails = z.infer<typeof ThrowDetails>;

export const VisualRecipe = z.object({
    headColour: IColour.default(Colour.White),
    headRadiusInPixels: z.number().nonnegative(),
    trailColour: IColour.default(Colour.White),
    trailLengthInPixels: z.number().positive(),
    rangeFalloffPower: z.number().positive()
});
export type VisualRecipe = z.infer<typeof VisualRecipe>;

export const Visual = z.object({
    velocity: z.number().positive(),
    headColour: IColour.default(Colour.White),
    headRadiusInPixels: z.number().nonnegative(),
    trailColour: IColour.default(Colour.White),
    trailLengthInMs: z.number().positive(),
    rangeFalloffPower: z.number().positive()
});
export type Visual = z.infer<typeof Visual>;

export const Tracer = z.object({
    segments: z.array(PathSegment).min(2),
    headColour: IColour,
    headRadiusInPixels: z.number().positive(),
    trailColour: IColour,
    trailLengthInMs: z.number().positive(),
    maxRangeInMs: z.number().positive(),
    rangeFalloffPower: z.number().positive()
});
export type Tracer = z.infer<typeof Tracer>;

export const HitSpark = z.object({
    pos: IVec2,
    timeMs: z.number().nonnegative(),
    colour: IColour,
    direction: IVec2,
    count: z.number().int().positive()
});
export type HitSpark = z.infer<typeof HitSpark>;

export const TileUpdate = z.object({
    tilePos: ITilePos,
    tileByRenderMode: z.object({
        [RenderMode.enum.MAP_MODE]: RenderList,
        [RenderMode.enum.FIRE_MODE]: RenderList
    })
});
export type TileUpdate = z.infer<typeof TileUpdate>;

export const TimedTileUpdate = TileUpdate.extend({
    timeMs: z.number().nonnegative()
});
export type TimedTileUpdate = z.infer<typeof TimedTileUpdate>;

export const InterestMask = z.union([z.literal("items"), z.literal("vfx"), z.string()]);
export type InterestMask = z.infer<typeof InterestMask>;
