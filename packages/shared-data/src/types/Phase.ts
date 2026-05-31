import { z } from "zod";

export const Phase = z.enum([
    "main_menu",
    "lobby",
    "armament",
    "deployment",
    "action",
    "game_over"
]);
export type Phase = z.infer<typeof Phase>;
