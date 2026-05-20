import { z } from 'zod';

export * from './Phase.js';

export const CLIENT_ID_QUERY_PARAM = 'client-id';
export const CREATE_OR_JOIN_QUERY_PARAM = 'mode';

export const statusResponseSchema = z.object({
	status: z.literal('ok'),
	message: z.string(),
});

export type StatusResponse = z.infer<typeof statusResponseSchema>;

export const ClientIdValidation = z.string().uuid();

export const CreateGameQuery = z.object({
	[CLIENT_ID_QUERY_PARAM]: ClientIdValidation,
});

export type CreateGameQuery = z.infer<typeof CreateGameQuery>;

export const GameId = z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
export type GameId = z.infer<GameId>;

export const CreateGameResponse = z.object({
	gameId: GameId
});
export type CreateGameResponse = z.infer<typeof CreateGameResponse>;

export function parseURLSearchParams<T extends z.ZodTypeAny>(
	schema: T,
	params: URLSearchParams,
): z.infer<T> {
	const data: Record<string, string[] | string | undefined> = {};

	for (const key of params.keys()) {
		const value = params.getAll(key).filter((v) => v !== String(undefined));
		if (value.length > 1) {
			data[key] = value;
		} else {
			data[key] = value.at(0);
		}
	}

	const parsed = schema.safeParse(data);

	if (parsed.success) {
		return parsed.data as z.infer<T>;
	} else {
		throw new Error('Invalid query parameters');
	}
}

export const ClientQueryParams = z.object({
	[CLIENT_ID_QUERY_PARAM]: ClientIdValidation,
	[CREATE_OR_JOIN_QUERY_PARAM]: z.union([z.literal('create'), z.literal('join')]).optional(),
});
export type ClientQueryParams = z.infer<typeof ClientQueryParams>;
