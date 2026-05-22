import {
	ClientQueryParams,
	parseURLSearchParams,
	CreateGameResponseBody,
	ClientId,
	GameId,
	JoinGameResponseBody,
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

type JoinGameOptions = {
	name: string;

	signal?: AbortSignal;
};

async function createGame(
	clientId: ClientId,
	options: CreateGameOptions,
): Promise<CreateGameResponseBody> {
	const { name, signal } = options;

	const res = await fetch("/api/game/create", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ clientId, name }),
		signal
	});

	const data: unknown = await res.json().catch(() => ({}));

	if (!res.ok) {
		const message =
			typeof data === "object" &&
			data !== null &&
			"error" in data &&
			typeof (data as { error: unknown }).error === "string"
				? (data as { error: string }).error
				: `Request failed (${res.status})`;
		throw new Error(message);
	}

	const response = CreateGameResponseBody.parse(data);

	return response;
}

async function joinGame(
	gameId: GameId,
	clientId: ClientId,
	options: JoinGameOptions
): Promise<JoinGameResponseBody> {
	const { name, signal } = options;

	const res = await fetch("/api/game/join", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ gameId, clientId, name }),
		signal
	});

	const data: unknown = await res.json().catch(() => ({}));

	if (!res.ok) {
		const message =
			typeof data === "object" &&
			data !== null &&
			"error" in data &&
			typeof (data as { error: unknown }).error === "string"
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

	const [clientId, setClientId] = useState<string | undefined>(validatedSearchParams["client-id"]);
	const [gameId, setGameId] = useState<string | undefined>(validatedSearchParams["game-id"]);
	const { mode } = validatedSearchParams;

	const { connected } = useGameSocket(gameId, clientId);

	useEffect(() => {
		if (!clientId) {
			setSearchParams({ ["client-id"]: oneTimeClientId });
			setClientId(oneTimeClientId);
			console.info(
				`No existing client-id - generating new clientId ${oneTimeClientId} and setting it`,
			);
		} else {
			console.info(`Existing client-id is ${clientId}`);
		}
	}, [clientId, setClientId, setSearchParams]);

	async function handleCreateGame(clientId: ClientId) {
		console.info("Attempting to create game");

		const name = "Default Name";
		const { gameId } = await createGame(clientId, { name });
		setGameId(gameId);

		console.info(`Created game with id: ${gameId}`);
	}

	async function handleJoinGame(gameId: GameId, clientId: ClientId) {
		console.info("Attempting to join game");

		const name = "Default Join Name";
		const { gameId: joinedGameId } = await joinGame(gameId, clientId, { name });

		console.info(`Joined game with id: ${joinedGameId}`);
	}

	useEffect(() => {
		if (connected) {
			return;
		}

		if (clientId) {
			switch (mode) {
				case "create": {
					if (clientId && !gameId) {
						handleCreateGame(clientId);
					}
					break;
				}
				case "join":
					if (gameId && clientId) {
						handleJoinGame(gameId, clientId);
					}
					break;
			}
		}
	}, [clientId, gameId, mode, connected]);

	return (
		<>
			<p>Client ID: {clientId}</p>
			<p>Game ID: {gameId}</p>
			<p>{connected ? "Connected to Server" : "Disconnected"}</p>
		</>
	);
}
