import z from "zod";

export const VfxId = z.string().nonempty();
export type VfxId = z.infer<typeof VfxId>;
