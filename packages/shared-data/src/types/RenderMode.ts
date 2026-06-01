import z from "zod";

const renderMode = ["UI_MODE", "MAP_MODE", "FIRE_MODE"] as const;

export const RenderMode = z.enum(renderMode);
export type RenderMode = z.infer<typeof RenderMode>;
