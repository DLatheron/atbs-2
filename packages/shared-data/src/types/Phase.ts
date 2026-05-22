import { z } from "zod";

export const Phase = z.enum(["lobby", "armament", "deployment", "turns", "game_over"]);
export type Phase = z.infer<typeof Phase>;
