import {
	CLIENT_ID_QUERY_PARAM,
	ClientQueryParams,
	parseURLSearchParams,
	CreateGameQuery,
	CreateGameResponseBody,
} from '@atbs/shared-data';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { useGameSocket } from './hooks';

// Generate this outside the React component so that its survives strict-mode re-renders, but still generates
// one a browser visit (if the query parameter is deleted).
const oneTimeClientId = uuidv4();

type CreateGameOptions = {
	name: string;

	signal?: AbortSignal;
};

async function createGame(
	clientId: string,
	options: CreateGameOptions,
): Promise<CreateGameResponseBody> {
	const { name, signal } = options;

	const queryParams: CreateGameQuery = { 'client-id': clientId };
	const url = `/api/game/create?${new URLSearchParams(queryParams).toString()}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ clientId, name }),
		signal,
	});

	const data: unknown = await res.json().catch(() => ({}));

	if (!res.ok) {
		const message =
			typeof data === 'object' &&
			data !== null &&
			'error' in data &&
			typeof (data as { error: unknown }).error === 'string'
				? (data as { error: string }).error
				: `Request failed (${res.status})`;
		throw new Error(message);
	}

	const response = CreateGameResponseBody.parse(data);

	return response;
}

export function App() {
	const [searchParams, setSearchParams] = useSearchParams();
	const validatedSearchParams = parseURLSearchParams(ClientQueryParams, searchParams);

	const [clientId, setClientId] = useState<string>(validatedSearchParams['client-id']);
	const [gameId, setGameId] = useState<string | undefined>();
	const { mode } = validatedSearchParams;

	const { connected } = useGameSocket(clientId, gameId);

	useEffect(() => {
		if (!clientId) {
			setSearchParams({ [CLIENT_ID_QUERY_PARAM]: oneTimeClientId });
			setClientId(oneTimeClientId);
			console.info(
				`No existing ${CLIENT_ID_QUERY_PARAM} - generating new clientId ${oneTimeClientId} and setting it`,
			);
		} else {
			console.info(`Existing ${CLIENT_ID_QUERY_PARAM} is ${clientId}`);
		}
	}, [clientId, setClientId, setSearchParams]);

	async function handleCreateGame(clientId: string) {
		console.info('Attempt to create game');

		if (!clientId) {
			throw new Error('Cannot call handleCreateGame with a falsy clientId');
		}
		const name = 'Default Name';
		const { gameId } = await createGame(clientId, { name });
		setGameId(gameId);

		console.info(`Created game with id: ${gameId}`);
	}

	useEffect(() => {
		if (clientId) {
			switch (mode) {
				case 'create': {
					handleCreateGame(clientId);
					break;
				}
				case 'join':
					console.info('Attempt to join game');
					break;
			}
		}
	}, [clientId, mode]);

	return (
		<>
			<p>Client ID: {clientId}</p>
			<p>Game ID: {gameId}</p>
			<p>{connected ? 'Connected to Server' : 'Disconnected'}</p>
		</>
	);
}
