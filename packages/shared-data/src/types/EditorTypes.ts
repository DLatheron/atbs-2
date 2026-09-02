import z from "zod";
import { ITilePos, Orientation } from "@atbs/maths";
import { ItemId, RenderList } from "./PrimitiveTypes.js";

export const TerrainPaletteEntry = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    uiImage: RenderList,
    allowRandomOrientation: z.boolean()
});
export type TerrainPaletteEntry = z.infer<typeof TerrainPaletteEntry>;

export const BlendPaletteEntry = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    uiImage: RenderList
});
export type BlendPaletteEntry = z.infer<typeof BlendPaletteEntry>;

export const TerrainPaletteWire = z.object({
    terrains: z.array(TerrainPaletteEntry).min(1),
    blends: z.array(BlendPaletteEntry).min(1)
});
export type TerrainPaletteWire = z.infer<typeof TerrainPaletteWire>;

export const SelectedTerrain = z.object({
    index: z.number().int().nonnegative(),
    orientation: z.enum(Orientation),
    randomiseOrientation: z.boolean(),
    compoundTerrain: z.boolean(),
    image1: z.object({
        index: z.number().int().nonnegative(),
        orientation: z.enum(Orientation),
        randomiseOrientation: z.boolean()
    }),
    blend: z.object({
        index: z.number().int().nonnegative(),
        orientation: z.enum(Orientation)
    }),
    image2: z.object({
        index: z.number().int().nonnegative(),
        orientation: z.enum(Orientation),
        randomiseOrientation: z.boolean()
    })
});
export type SelectedTerrain = z.infer<typeof SelectedTerrain>;

export const EditorHistoryState = z.object({
    canUndo: z.boolean(),
    canRedo: z.boolean(),
    hasUnsavedChanges: z.boolean()
});
export type EditorHistoryState = z.infer<typeof EditorHistoryState>;

export const FurniturePaletteTileEntry = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    uiImage: RenderList
});
export type FurniturePaletteTileEntry = z.infer<typeof FurniturePaletteTileEntry>;

export const FurniturePaletteEntry = z.object({
    id: z.string().nonempty(),
    furniture: z.array(z.array(FurniturePaletteTileEntry)).min(1),
    allowRandomOrientation: z.boolean()
});
export type FurniturePaletteEntry = z.infer<typeof FurniturePaletteEntry>;

export const FurniturePaletteWire = z.object({
    furniture: z.array(FurniturePaletteEntry).min(1)
});
export type FurniturePaletteWire = z.infer<typeof FurniturePaletteWire>;

export const SelectedFurniture = z.object({
    index: z.number().int().nonnegative(),
    orientation: z.enum(Orientation),
    randomiseOrientation: z.boolean()
});
export type SelectedFurniture = z.infer<typeof SelectedFurniture>;

export const WallEdgeTuple = z.tuple([
    z.string().nullable(),
    z.string().nullable(),
    z.string().nullable(),
    z.string().nullable()
]);
export type WallEdgeTuple = z.infer<typeof WallEdgeTuple>;

export const WallPaletteEntry = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    uiImage: RenderList,
    edges: WallEdgeTuple
});
export type WallPaletteEntry = z.infer<typeof WallPaletteEntry>;

export const WallHotKeyAction = z.object({
    id: z.string().nonempty(),
    orientation: z.enum(Orientation)
});
export type WallHotKeyAction = z.infer<typeof WallHotKeyAction>;

export const WallPaletteWire = z.object({
    walls: z.array(WallPaletteEntry).min(1),
    hotKeys: z.record(z.string(), z.array(WallHotKeyAction)).optional()
});
export type WallPaletteWire = z.infer<typeof WallPaletteWire>;

export const SelectedWall = z.object({
    index: z.number().int().nonnegative(),
    orientation: z.enum(Orientation),
    autoFit: z.boolean(),
    direction: z.enum(Orientation).optional()
});
export type SelectedWall = z.infer<typeof SelectedWall>;

export const ItemPaletteEntry = z.object({
    id: ItemId,
    name: z.string().nonempty(),
    uiImage: RenderList
});
export type ItemPaletteEntry = z.infer<typeof ItemPaletteEntry>;

export const ItemPaletteWire = z.object({
    items: z.array(ItemPaletteEntry).min(1)
});
export type ItemPaletteWire = z.infer<typeof ItemPaletteWire>;

export const SelectedItem = z.object({
    index: z.number().int().nonnegative()
});
export type SelectedItem = z.infer<typeof SelectedItem>;

export const MARKER_SIDE_IDS = ["deploy-1", "deploy-2", "safe-1", "safe-2"] as const;
export const MarkerSideId = z.enum(MARKER_SIDE_IDS);
export type MarkerSideId = (typeof MARKER_SIDE_IDS)[number];

export const EditorDeploymentZoneWire = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    minUnits: z.number().int().nonnegative().optional(),
    maxUnits: z.number().int().nonnegative().optional(),
    orientation: z.enum(Orientation),
    tiles: z.array(ITilePos),
    isDrawing: z.boolean(),
    rectangles: z.array(
        z.object({
            col: z.number().int(),
            row: z.number().int(),
            width: z.number().int().positive(),
            height: z.number().int().positive()
        })
    )
});
export type EditorDeploymentZoneWire = {
    id: string;
    name: string;
    minUnits?: number;
    maxUnits?: number;
    orientation: Orientation;
    tiles: ITilePos[];
    isDrawing: boolean;
    rectangles: { col: number; row: number; width: number; height: number }[];
};

export const EditorMarkersState = z.object({
    selectedSideId: MarkerSideId,
    selectedZoneId: z.string().nullable(),
    sides: z.object({
        "deploy-1": z.object({ zones: z.array(EditorDeploymentZoneWire) }),
        "deploy-2": z.object({ zones: z.array(EditorDeploymentZoneWire) }),
        "safe-1": z.object({ zones: z.array(EditorDeploymentZoneWire) }),
        "safe-2": z.object({ zones: z.array(EditorDeploymentZoneWire) })
    })
});
export type EditorMarkersState = {
    selectedSideId: MarkerSideId;
    selectedZoneId: string | null;
    sides: Record<MarkerSideId, { zones: EditorDeploymentZoneWire[] }>;
};

export const MAP_RESIZE_ANCHORS = [
    "north-west",
    "north",
    "north-east",
    "west",
    "center",
    "east",
    "south-west",
    "south",
    "south-east"
] as const;
export const MapResizeAnchor = z.enum(MAP_RESIZE_ANCHORS);
export type MapResizeAnchor = z.infer<typeof MapResizeAnchor>;
