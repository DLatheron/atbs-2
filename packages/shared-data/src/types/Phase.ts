import { z } from "zod";

const phase = ["main_menu", "lobby", "armament", "deployment", "action", "game_over"] as const;

export const Phase = z.enum(phase);
export type Phase = z.infer<typeof Phase>;
