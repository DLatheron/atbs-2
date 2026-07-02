import z from "zod";
import { IColour } from "./Colour.js";
import { ITilePos } from "./TilePos.js";
import { IVec2 } from "./Vec2.js";

const debugGraphicType = ["tile", "box", "line", "arc", "point", "text", "path"] as const;
export const DebugGraphicType = z.enum(debugGraphicType);
export type DebugGraphicType = z.infer<typeof DebugGraphicType>;

export const PathSegment = z.object({
    pos: IVec2,
    time: z.number().nonnegative()
});
export type PathSegment = z.infer<typeof PathSegment>;

export const DebugTile = z.object({
    type: z.literal(DebugGraphicType.enum.tile),
    tilePos: ITilePos,
    fillColour: IColour.optional(),
    strokeColour: IColour.optional(),
    strokeThickness: z.number().min(0).max(100).optional()
});
export type DebugTile = z.infer<typeof DebugTile>;

export const DebugBox = z.object({
    type: z.literal(DebugGraphicType.enum.box),
    centerWorldPos: IVec2,
    width: z.number().positive(),
    height: z.number().positive(),
    fillColour: IColour.optional(),
    strokeColour: IColour.optional(),
    strokeThickness: z.number().nonnegative().optional()
});
export type DebugBox = z.infer<typeof DebugBox>;

export const DebugLine = z.object({
    type: z.literal(DebugGraphicType.enum.line),
    srcWorldPos: IVec2,
    dstWorldPos: IVec2,
    strokeColour: IColour,
    strokeThickness: z.number().positive().optional(),
    lineDash: z.array(z.number()).optional()
});
export type DebugLine = z.infer<typeof DebugLine>;

export const DebugArc = z.object({
    type: z.literal(DebugGraphicType.enum.arc),
    centerWorldPos: IVec2,
    radius: z.number().positive(),
    startAngleInDegrees: z.number().min(-360).max(360),
    endAngleInDegrees: z.number().min(-360).max(360),
    clockwise: z.boolean().optional(),
    strokeColour: IColour.optional(),
    strokeThickness: z.number().nonnegative().optional(),
    fillColour: IColour.optional()
});
export type DebugArc = z.infer<typeof DebugArc>;

export const DebugPoint = z.object({
    type: z.literal(DebugGraphicType.enum.point),
    worldPos: IVec2,
    colour: IColour,
    size: z.number().positive().optional()
});
export type DebugPoint = z.infer<typeof DebugPoint>;

export const DebugText = z.object({
    type: z.literal(DebugGraphicType.enum.text),
    worldPos: IVec2,
    text: z.string(),
    colour: IColour,
    fontFamily: z.string().nonempty().optional(),
    fontSize: z.number().optional()
});
export type DebugText = z.infer<typeof DebugText>;

export const DebugPath = z.object({
    type: z.literal(DebugGraphicType.enum.path),
    segments: z.array(PathSegment).min(2),
    strokeColour: IColour,
    strokeThickness: z.number().positive().optional(),
    lineDash: z.array(z.number()).optional(),
    trail: z.tuple([z.number(), z.number(), z.number()]).optional()
});
export type DebugPath = z.infer<typeof DebugPath>;

export const DebugGraphic = z.discriminatedUnion("type", [
    DebugTile,
    DebugBox,
    DebugLine,
    DebugArc,
    DebugPoint,
    DebugText,
    DebugPath
]);
export type DebugGraphic = z.infer<typeof DebugGraphic>;
