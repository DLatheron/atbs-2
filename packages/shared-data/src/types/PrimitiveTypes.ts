import z from "zod";
import { Phase } from "./Phase.js";
import { Orientation, TilePosRecipe } from "@atbs/maths";
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

export const ImageId = z.string().min(1);
export type ImageId = z.infer<typeof ImageId>;

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
    max: z.number().nonnegative(),
    value: z.number().nonnegative().optional()
});
export type AttributeDef = z.infer<typeof AttributeDef>;

export const Attribute = z.object({
    max: z.number().nonnegative(),
    value: z.number().nonnegative()
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
    width: z.number().positive(),
    height: z.number().positive(),
    tileSize: z.number().positive(),
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
    width: z.number().positive(),
    height: z.number().positive()
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
    victoryPoints: z.number().min(0)
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

export const UnitSummary = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: Description,
    orientation: z.enum(Orientation),
    viewAngleInDegrees: z.number().positive(),
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
    uiImage: RenderList
});
export type UnitSummary = z.infer<typeof UnitSummary>;

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

const errorType = ["INSUFFICIENT_ACTION_POINTS"] as const;

export const ErrorType = z.enum(errorType);
export type ErrorType = z.infer<typeof ErrorType>;
