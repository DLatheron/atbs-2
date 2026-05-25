import z from "zod";
import { ClientId, Description, SideId } from "./PrimitiveTypes.js";

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

    scenario: z
        .object({
            id: z.string().min(1),
            name: z.string().min(1),
            description: Description,
            sides: z.array(
                z.object({
                    id: SideId,
                    name: z.string().min(1),
                    description: Description
                })
            )
        })
        .optional()
});
export type LobbyState = z.infer<typeof LobbyState>;
