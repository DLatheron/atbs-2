import z from "zod";
import { ClientId, ScenarioSummary, SideId } from "./PrimitiveTypes.js";

export const LobbyState = z.object({
    ownerId: ClientId,

    clients: z.array(
        z.object({
            id: ClientId,
            name: z.string().min(1),

            sideId: SideId.nullable(),
            ready: z.boolean().default(false)
        })
    ),

    scenario: ScenarioSummary.optional(),

    options: z.object({
        canStartGame: z.boolean(),
        availableSideIds: z.array(SideId)
    })
});
export type LobbyState = z.infer<typeof LobbyState>;
