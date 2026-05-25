import { createServer } from "http";
import type { Duplex } from "stream";
import express from "express";
import type { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import {
    parseURLSearchParams,
    ConnectSocketQueryParams,
    ServerToClientMessage
} from "@atbs/shared-data";

import { createApp } from "./app.js";
import { gameManager } from "./game/GameManager.js";

const port = Number(process.env.PORT ?? 3000);

const app = createApp();

app.use(express.json());

const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

function sendJson(ws: WebSocket, message: ServerToClientMessage) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
        const host = request.headers.host ?? "localhost";
        const url = new URL(request.url ?? "", `http://${host}`);
        if (url.pathname !== "/ws/game") {
            console.error("Incorrect path - destroying socket");
            socket.destroy();
            return;
        }
        wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
            wss.emit("connection", ws, request);
        });
    } catch (error) {
        console.error("Upgrade error - destroying socket", error);
        socket.destroy();
    }
});

wss.on("connection", function connection(ws: WebSocket, req: IncomingMessage) {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "", `http://${host}`);
    const validatedQueryParams = parseURLSearchParams(ConnectSocketQueryParams, url.searchParams);
    const { clientId, gameId } = validatedQueryParams;

    const game = gameManager.findGame(gameId);
    if (!game) {
        console.error(`Connection from client: ${clientId}, failed to find game: ${gameId}`);
        return;
    }

    const client = game.findClient(clientId);
    if (!client) {
        console.error(`Client: ${clientId}, not found in game: ${gameId}`);
        return;
    }
    client.socketContext = {
        send: (message: ServerToClientMessage) => {
            sendJson(ws, message);
        }
    };

    client.send({ type: "server:hello", payload: { gameId } });

    ws.on("message", function message(data: MessageEvent) {
        game.receiveMessage(data, client);
    });

    ws.on("close", function close() {
        game.clientDisconnected(client);
        game.removeClient(client.clientId);
    });

    ws.on("error", function error(error: unknown) {
        console.error(error);
    });
});

server.listen(port, () => {
    console.clear();
    console.info(`Server listening on http://localhost:${port}`);
    console.info("WebSocket server ready");
});
