import z from "zod";

export const ClientToServerMessage = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("client:ping"),
        payload: z.object({ nonce: z.number() })
    })
]);
export type ClientToServerMessage = z.infer<typeof ClientToServerMessage>;
