import z from "zod";

export const ServerToClientMessage = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("server:hello"),
        payload: z.object({ gameId: z.string() })
    }),
    z.object({
        type: z.literal("server:pong"),
        payload: z.object({ nonce: z.number() })
    })
]);
export type ServerToClientMessage = z.infer<typeof ServerToClientMessage>;
