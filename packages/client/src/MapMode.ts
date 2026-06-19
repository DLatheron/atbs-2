import z from "zod";

const mapMode = ["map-mode", "unit-mode", "fire-mode"] as const;
export const MapMode = z.enum(mapMode);
export type MapMode = z.infer<typeof MapMode>;
