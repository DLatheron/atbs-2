import { useEffect, useState } from "react";
import { ClientId, GameId } from "@atbs/shared-data";
import { GameSocket } from "../GameSocket.js";

export function useGameSocket(
	gameId: GameId | undefined,
	clientId: ClientId | undefined
): { connected: boolean } {
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		if (!gameId || !clientId) {
			return;
		}

		let cancelled = false;
		const gameSocket = new GameSocket(gameId, clientId);
		console.info("Socket created for", gameId, "from", clientId);

		/** Defer past React Strict Mode's mount/unmount so the first real connection is not aborted mid-handshake. */
		const connectTimer = setTimeout(() => {
			if (cancelled) {
				return;
			}

			gameSocket.connect({
				// displayName: displayNameRef.current,
				onOpen: () => {
					if (!cancelled) {
						console.info("Socket connected");
						setConnected(true);
					}
				},
				onClose: () => {
					console.info("Socket closed");
					setConnected(false);
					// if (!cancelled) {
					//     onUnexpectedCloseRef.current?.();
					// }
				},
			});
		}, 0);

		return () => {
			console.info("Hook unmounting");
			cancelled = true;
			clearTimeout(connectTimer);
			// sendRef.current = () => {};
			// lastSentRenameRef.current = null;
			gameSocket.disconnect();
			// setActivityLog([]);
		};
	}, [clientId, gameId]);

	return { connected };
}
