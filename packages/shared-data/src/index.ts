import { z } from 'zod';

export const statusResponseSchema = z.object({
	status: z.literal('ok'),
	message: z.string(),
});

export type StatusResponse = z.infer<typeof statusResponseSchema>;
