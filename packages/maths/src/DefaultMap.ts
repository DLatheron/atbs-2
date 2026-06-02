import z from "zod";

export function DefaultMap<T extends z.ZodTypeAny>(itemSchema: T) {
    return z.intersection(z.record(z.string(), itemSchema), z.object({ default: itemSchema }));
}
