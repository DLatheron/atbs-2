import z from "zod";
import { LobbyState } from "./LobbyState.js";
import { ClientId } from "./PrimitiveTypes.js";

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
            name: z.string().min(1)
        })
    })
]);
export type ServerToClientMessage = z.infer<typeof ServerToClientMessage>;
