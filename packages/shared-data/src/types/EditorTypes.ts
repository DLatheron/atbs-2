import z from "zod";
import { Orientation } from "@atbs/maths";
import { RenderList } from "./PrimitiveTypes.js";

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
    canRedo: z.boolean()
});
export type EditorHistoryState = z.infer<typeof EditorHistoryState>;
