import { useServerSocket } from "./hooks";
import { useClientId } from "./hooks/useClientId";

export function App() {
    const { clientId } = useClientId();
    const { connected, gameId } = useServerSocket({ clientId });

    return (
        <>
            <p>Client ID: {clientId}</p>
            <p>Game ID: {gameId}</p>
            <p>{connected ? "Connected to Server" : "Disconnected"}</p>
        </>
    );
}
