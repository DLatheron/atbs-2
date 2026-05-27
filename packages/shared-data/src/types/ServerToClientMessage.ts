import z from "zod";
import { LobbyState } from "./LobbyState.js";
import { ClientId, SideId } from "./PrimitiveTypes.js";

export const ServerToClientMessage = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("server:hello"),
        payload: z.object({ gameId: z.string() })
    }),
    z.object({
        type: z.literal("server:pong"),
        payload: z.object({ nonce: z.number() })
    }),
    z.object({
        type: z.literal("lobby:state"),
        payload: LobbyState
    }),
    z.object({
        type: z.literal("lobby:client:connected"),
        payload: z.object({
            clientId: ClientId,
            name: z.string()
        })
    }),
    z.object({
        type: z.literal("lobby:client:disconnected"),
        payload: z.object({
            clientId: ClientId,
            name: z.string()
        })
    }),
    z.object({
        type: z.literal("server:client:renamed"),
        payload: z.object({
            oldName: z.string(),
            newName: z.string()
        })
    }),
    z.object({
        type: z.literal("server:client:side:changed"),
        payload: z.object({
            old: z
                .object({
                    sideId: SideId,
                    sideName: z.string()
                })
                .optional(),
            new: z
                .object({
                    sideId: SideId,
                    sideName: z.string()
                })
                .optional()
        })
    }),
    z.object({
        type: z.literal("server:client:ready"),
        payload: z.object({
            client: z.object({
                id: ClientId,
                name: z.string()
            }),
            ready: z.boolean()
        })
    })
]);
export type ServerToClientMessage = z.infer<typeof ServerToClientMessage>;
