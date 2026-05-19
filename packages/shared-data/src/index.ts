import { z } from 'zod';

export const statusResponseSchema = z.object({
	status: z.literal('ok'),
	message: z.string(),
});

export type StatusResponse = z.infer<typeof statusResponseSchema>;

export const createGameQuerySchema = z.object({
	'client-id': z.string().min(1),
	'auto-join': z.literal('true').optional(),
});

export type CreateGameQuery = z.infer<typeof createGameQuerySchema>;

export const gameIdSchema = z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

export const createGameResponseSchema = z.object({
	gameId: gameIdSchema,
});

export type CreateGameResponse = z.infer<typeof createGameResponseSchema>;
