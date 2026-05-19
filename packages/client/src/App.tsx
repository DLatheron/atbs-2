import { CLIENT_ID_QUERY_PARAM, ClientQueryParams, parseURLSearchParams } from '@atbs/shared-data';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// Generate this outside the React component so that its survives strict-mode re-renders, but still generates
// one a browser visit (if the query parameter is deleted).
const oneTimeClientId = uuidv4();

export function App() {
	const [searchParams, setSearchParams] = useSearchParams();
	const validatedSearchParams = parseURLSearchParams(ClientQueryParams, searchParams);

	const [clientId, setClientId] = useState<string>(validatedSearchParams['client-id']);
	const [gameId, setGameId] = useState<string | undefined>();
	const { mode } = validatedSearchParams;

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

	useEffect(() => {
		if (clientId) {
			switch (mode) {
				case 'create':
					console.info('Attempt to create game');
					break;

				case 'join':
					console.info('Attempt to join game');
					break;
			}
		}
	}, [clientId, mode]);

	return <p>Client ID: {clientId}</p>;
}
