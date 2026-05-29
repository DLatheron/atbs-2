import z from "zod";
import { LobbyState } from "./LobbyState.js";
import { ClientId, ScenarioSummary, SideId } from "./PrimitiveTypes.js";
import { Phase } from "./Phase.js";

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
        type: z.literal("server:lobby:state"),
        payload: LobbyState
    }),
    z.object({
        type: z.literal("server:client:connected"),
        payload: z.object({
            client: z.object({
                id: ClientId,
                name: z.string()
            })
        })
    }),
    z.object({
        type: z.literal("server:client:disconnected"),
        payload: z.object({
            client: z.object({
                id: ClientId,
                name: z.string()
            })
        })
    }),
    z.object({
        type: z.literal("server:lobby:client:renamed"),
        payload: z.object({
            oldName: z.string(),
            newName: z.string()
        })
    }),
    z.object({
        type: z.literal("server:lobby:client:side:changed"),
        payload: z.object({
            oldSide: z
                .object({
                    id: SideId,
                    name: z.string()
                })
                .optional(),
            newSide: z
                .object({
                    id: SideId,
                    name: z.string()
                })
                .optional()
        })
    }),
    z.object({
        type: z.literal("server:lobby:client:ready"),
        payload: z.object({
            client: z.object({
                id: ClientId,
                name: z.string()
            }),
            ready: z.boolean()
        })
    }),
    z.object({
        type: z.literal("server:phase"),
        payload: z.object({ phase: Phase })
    }),
    z.object({
        type: z.literal("server:lobby:scenario:list"),
        payload: z.object({
            scenarios: z.array(ScenarioSummary).min(1)
        })
    })
]);
export type ServerToClientMessage = z.infer<typeof ServerToClientMessage>;
