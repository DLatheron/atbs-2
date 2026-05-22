import { ClientId, GameId } from "@atbs/shared-data";

// function parseServerMessage(data: unknown) {
//     console.info(data);
// }

export type GameSocketConnectOptions = {
    onOpen?: () => void;
    onClose?: () => void;
    signal?: AbortSignal;
};

export class GameSocket {
    private readonly _gameId: GameId;
    private readonly _clientId: ClientId;

    private _ws: WebSocket | null;

    constructor(gameId: GameId, clientId: ClientId) {
        this._gameId = gameId;
        this._clientId = clientId;

        this._ws = null;
    }

    connect(options: GameSocketConnectOptions): this {
        // Close any existing socket.
        this.disconnect();

        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const params = new URLSearchParams({
            gameId: this._gameId,
            clientId: this._clientId
        });
        const url = `${proto}//${window.location.host}/ws/game?${new URLSearchParams(params).toString()}`;
        console.info(
            "Attempting connection to:",
            this._gameId,
            "from:",
            this._clientId,
            "at:",
            url
        );
        const ws = new WebSocket(url);
        this._ws = ws;

        // const ctx: LobbySocketClientContext = { send };

        ws.onopen = () => {
            options?.onOpen?.();
        };

        ws.onmessage = (ev) => {
            let data: unknown;
            try {
                data = JSON.parse(String(ev.data));
            } catch {
                return;
            }

            console.info(JSON.stringify(data, null, 4));
            // const parsed = parseServerMessage(data);
            // if (!parsed.success) {
            //     return;
            // }
            // const handler = this.handlers.get(parsed.data.type);
            // if (handler) {
            //     handler(ctx, parsed.data.payload);
            // }
        };

        ws.onclose = () => {
            options?.onClose?.();
        };

        ws.onerror = (error) => {
            console.error("Socket error", error);
            console.error(error);

            this.disconnect();
        };

        return this;
    }

    disconnect(): void {
        if (this._ws) {
            this._ws.onopen = null;
            this._ws.onmessage = null;
            this._ws.onclose = null;
            this._ws.close();
            this._ws = null;
        }
    }

    // send(message: ClientToServerMessage) {
    //     if (this._ws?.readyState === WebSocket.OPEN) {
    //         this._ws.send(JSON.stringify(message));
    //     }
    // }
}
