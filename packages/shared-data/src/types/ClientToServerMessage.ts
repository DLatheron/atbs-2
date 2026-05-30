import z from "zod";
import { ClientId, ScenarioId, SideId } from "./PrimitiveTypes.js";

export const ClientPingPayload = z.object({ nonce: z.number() });
export type ClientPingPayload = z.infer<typeof ClientPingPayload>;

export const ClientRenamePayload = z.object({ name: z.string().min(1) });
export type ClientRenamePayload = z.infer<typeof ClientRenamePayload>;

export const ClientToServerMessage = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("client:ping"),
        payload: ClientPingPayload
    }),
    z.object({
        type: z.literal("client:rename"),
        payload: ClientRenamePayload
    }),
    z.object({
        type: z.literal("client:side:change"),
        payload: z.object({
            clientId: ClientId,
            sideId: SideId.nullable()
        })
    }),
    z.object({
        type: z.literal("client:ready"),
        payload: z.object({
            ready: z.boolean()
        })
    }),
    z.object({
        type: z.literal("client:scenario:change"),
        payload: z.object({
            scenarioId: ScenarioId.nullable()
        })
    }),
    z.object({
        type: z.literal("client:lobby:game:start"),
        payload: z.undefined()
    }),
    z.object({
        type: z.literal("client:armament:end"),
        payload: z.undefined()
    }),
    z.object({
        type: z.literal("client:deployment:end"),
        payload: z.undefined()
    })
]);
export type ClientToServerMessage = z.infer<typeof ClientToServerMessage>;
