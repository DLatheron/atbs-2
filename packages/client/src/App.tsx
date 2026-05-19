import { statusResponseSchema } from '@atbs/shared-data';
import { useEffect, useState } from 'react';

export function App() {
	const [message, setMessage] = useState('Loading status…');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function loadStatus() {
			try {
				const response = await fetch('/api/status');
				if (!response.ok) {
					throw new Error(`Request failed (${response.status})`);
				}

				const data = statusResponseSchema.parse(await response.json());
				if (!cancelled) {
					setMessage(data.message);
					setError(null);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'Unknown error');
				}
			}
		}

		void loadStatus();

		return () => {
			cancelled = true;
		};
	}, []);

	if (error) {
		return <p role="alert">Could not reach the server: {error}</p>;
	}

	return <p>{message}</p>;
}
