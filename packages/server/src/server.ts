import { createServer } from "http";
import type { Duplex } from "stream";
import express from "express";
import type { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import {
    parseURLSearchParams,
    ConnectSocketQueryParams,
    ConnectEditorSocketQueryParams
} from "@atbs/shared-data";

import { createApp } from "./app.js";
import { gameManager } from "./game/GameManager.js";
import { editorManager } from "./editor/EditorManager.js";
import { config } from "./config/config.schema.js";
import { Logger } from "@atbs/misc";

async function startServer() {
    const logger = new Logger("Server", config.logLevels?.server);

    logger.info("Configuration:");
    logger.dir(config, { depth: null, colors: true, compact: false });

    process.on("uncaughtException", function (error) {
        logger.error(error);
    });

    const port = Number(config.port);

    const app = await createApp();

    app.use(express.json());

    const server = createServer(app);

    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        try {
            const host = request.headers.host ?? "localhost";
            const url = new URL(request.url ?? "", `http://${host}`);
            if (url.pathname !== "/ws/game" && url.pathname !== "/ws/editor") {
                logger.error("Incorrect path - destroying socket");
                socket.destroy();
                return;
            }
            wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
                wss.emit("connection", ws, request);
            });
        } catch (error) {
            logger.error("Upgrade error - destroying socket", error);
            socket.destroy();
        }
    });

    wss.on("connection", function connection(socket: WebSocket, req: IncomingMessage) {
        try {
            const host = req.headers.host ?? "localhost";
            const url = new URL(req.url ?? "", `http://${host}`);

            if (url.pathname === "/ws/editor") {
                const validatedQueryParams = parseURLSearchParams(
                    ConnectEditorSocketQueryParams,
                    url.searchParams
                );
                const { clientId, editorId } = validatedQueryParams;

                const editor = editorManager.findEditor(editorId);
                if (!editor) {
                    logger.error(
                        `Connection from client: ${clientId}, failed to find editor: ${editorId}`
                    );
                    socket.close(4004, "Editor not found");
                    return;
                }

                const client = editor.findClient(clientId);
                if (!client) {
                    logger.error(`Client: ${clientId}, not found in editor: ${editorId}`);
                    socket.close(4005, "Client not found");
                    return;
                }

                client.assignSocket(socket);
                return;
            }

            const validatedQueryParams = parseURLSearchParams(
                ConnectSocketQueryParams,
                url.searchParams
            );
            const { clientId, gameId } = validatedQueryParams;

            const game = gameManager.findGame(gameId);
            if (!game) {
                logger.error(`Connection from client: ${clientId}, failed to find game: ${gameId}`);
                socket.close(4004, "Game not found");
                return;
            }

            const client = game.findClient(clientId);
            if (!client) {
                logger.error(`Client: ${clientId}, not found in game: ${gameId}`);
                socket.close(4005, "Client not found");
                return;
            }

            client.assignSocket(socket);
        } catch (error) {
            logger.error("WebSocket connection error - closing socket", error);
            socket.close(4003, "Connection rejected");
        }
    });

    server.listen(port, () => {
        logger.clear();
        logger.info(`Server listening on http://localhost:${port}`);
        logger.info("WebSocket server ready");
    });
}

startServer();
