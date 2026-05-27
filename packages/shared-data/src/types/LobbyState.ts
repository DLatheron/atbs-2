import z from "zod";
import { ClientId, ScenarioSummary, SideId } from "./PrimitiveTypes.js";

export const LobbyState = z.object({
    ownerId: ClientId,

    clients: z.array(
        z.object({
            id: ClientId,
            name: z.string().min(1),

            sideId: SideId.optional(),
            ready: z.boolean().default(false)
        })
    ),

    scenario: ScenarioSummary.optional()
});
export type LobbyState = z.infer<typeof LobbyState>;
