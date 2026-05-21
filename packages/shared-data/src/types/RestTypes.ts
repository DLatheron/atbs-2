import { z } from 'zod';

import { ClientId, GameId } from './PrimitiveTypes.js';

export const CLIENT_ID_QUERY_PARAM = 'client-id';
export const CREATE_OR_JOIN_QUERY_PARAM = 'mode';

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

export const CreateOrJoin = z.union([z.literal('create'), z.literal('join')]).optional();
export type CreateOrJoin = z.infer<typeof CreateOrJoin>;

export const StatusResponseBody = z.object({
	status: z.literal('ok'),
	message: z.string(),
});
export type StatusResponseBody = z.infer<typeof StatusResponseBody>;

export const CreateGameQuery = z.object({
	[CLIENT_ID_QUERY_PARAM]: ClientId,
});
export type CreateGameQuery = z.infer<typeof CreateGameQuery>;

export const ClientQueryParams = z.object({
	[CLIENT_ID_QUERY_PARAM]: ClientId,
	[CREATE_OR_JOIN_QUERY_PARAM]: CreateOrJoin,
});
export type ClientQueryParams = z.infer<typeof ClientQueryParams>;

export const CreateGameRequestBody = z.object({
	clientId: ClientId,
	name: z.string().min(1).max(64).default('Default Client Name'),
});
export type CreateGameRequestBody = z.infer<typeof CreateGameRequestBody>;

export const CreateGameResponseBody = z.object({
	gameId: GameId,
});
export type CreateGameResponseBody = z.infer<typeof CreateGameResponseBody>;

export const ConnectSocketQueryParams = z.object({
	clientId: ClientId,
	gameId: GameId,
});
export type ConnectSocketQueryParams = z.infer<typeof ConnectSocketQueryParams>;
