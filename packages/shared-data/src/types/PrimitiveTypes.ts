import z from "zod";
import { Phase } from "./Phase.js";
import { Maths, Orientation, TilePosRecipe } from "@atbs/maths";
import { RenderMode } from "./RenderMode.js";

export const ClientId = z.uuid();
export type ClientId = z.infer<typeof ClientId>;

export const GameId = z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
export type GameId = z.infer<typeof GameId>;

export const ScenarioId = z.string().min(1);
export type ScenarioId = z.infer<typeof ScenarioId>;

export const SideId = z.string().min(1);
export type SideId = z.infer<typeof SideId>;

export const MapId = z.string().min(1);
export type MapId = z.infer<typeof MapId>;

export const TerrainId = z.string().min(1);
export type TerrainId = z.infer<typeof TerrainId>;

export const ObjectId = z.string().min(1);
export type ObjectId = z.infer<typeof ObjectId>;

export const UnitId = z.string().min(1);
export type UnitId = z.infer<typeof UnitId>;

export const ItemId = z.string().min(1);
export type ItemId = z.infer<typeof ItemId>;

export const InstanceId = z.string().min(1);
export type InstanceId = z.infer<typeof InstanceId>;

export const ImageId = z.string().min(1);
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
    id: z.string().min(1),
    name: z.string().min(1),
    description: Description,
    sides: z.array(
        z.object({
            id: SideId,
            name: z.string().min(1),
            description: Description
        })
    )
});
export type ScenarioSummary = z.infer<typeof ScenarioSummary>;

export const TileInfo = z.object({
    tilePos: TilePosRecipe,
    terrain: z.object({
        name: z.string(),
        uiImage: RenderList,
        description: Description
    }),
    unit: z
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

const errorType = ["INSUFFICIENT_ACTION_POINTS", "UNABLE_TO_MOVE_THERE"] as const;

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
            return Maths.Random(value.min, value.max);

        default:
            throw new Error(`Unexpected distribution: ${value.distribution}`);
    }
}

const unitType = ["human"] as const;
export const UnitType = z.enum(unitType);
export type UnitType = z.infer<typeof UnitType>;

const damageType = ["default", "disorientation"] as const;
export const DamageType = z.enum(damageType);
export type DamageType = z.infer<typeof DamageType>;

export const DamageMap = z.union([
    z.record(UnitType, z.number().positive()),
    z.object({
        type: DamageType.default(DamageType.enum.default),
        default: z.number().positive()
    })
]);

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

export const FireModeDetails = z.object({
    accuracy: z.number().min(0).max(100),
    actionPoints: z.int().positive()
});
export type FireModeDetails = z.infer<typeof FireModeDetails>;

export const FireModes = z.union([
    z.object({
        [FireSelector.enum.single]: z.object({
            ammoUse: z.int().positive(),
            fireModeDetails: z.record(FireMode, FireModeDetails)
        })
    }),
    z.object({
        [FireSelector.enum.burst]: z.object({
            ammoUse: z.int().positive(),
            rpm: z.int().positive(),
            fireModeDetails: z.record(FireMode, FireModeDetails)
        })
    }),
    z.object({
        [FireSelector.enum.auto]: z.object({
            rpm: z.int().positive(),
            fireModeDetails: z.record(
                FireMode,
                FireModeDetails.extend({
                    actionPointsPerRound: z.int().positive()
                })
            )
        })
    })
]);
export type FireModes = z.infer<typeof FireModes>;

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
    uiImage: RenderList
});
export type ItemSummary = z.infer<typeof ItemSummary>;

export const UnitSummary = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: Description,
    orientation: z.enum(Orientation),
    viewAngleInDegrees: z.int().positive(),
    isDirectional: z.boolean().optional().default(true),
    attributes: z.object({
        actionPoints: Attribute,
        constitution: Attribute,
        fitness: Attribute,
        morale: Attribute,
        stamina: Attribute,
        speed: Attribute,
        strength: Attribute,
        weight: z.number().positive()
    }),
    uiImage: RenderList,
    actions: z.object({
        canFire: z.boolean(),
        canThrow: z.boolean(),
        canAction: z.boolean(),
        canInventory: z.boolean()
    }),
    itemInUse: ItemSummary.nullable()
});
export type UnitSummary = z.infer<typeof UnitSummary>;

export const FireModeItemSummary = ItemSummary.extend({
    weapons: z.array(
        z.object({
            id: ItemId,
            name: z.string(),
            shortName: z.string(),
            description: Description,
            capacity: z.int().nonnegative(),
            maxCapacity: z.int().nonnegative(),
            fireModes: FireModes,
            uiImage: RenderList
        })
    )
});
export type FireModeItemSummary = z.infer<typeof FireModeItemSummary>;

export const InventorySummary = z.object({
    inUse: z.number().min(-1),
    items: ItemSummary
});
export type InventorySummary = z.infer<typeof InventorySummary>;
