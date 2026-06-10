import { ClientId, ServerToClientMessage, SideId } from "@atbs/shared-data";
import type { Client } from "./Client.js";
import { Misc, TilePos } from "@atbs/maths";

export class MessageRouter {
    private readonly _sideIds: SideId[];
    private readonly _sideIdToClient: Map<SideId, Client>;
    private readonly _clientIdToSideId: Map<ClientId, SideId>;
    private readonly _sideIdToMessageQueue: Map<SideId, ServerToClientMessage[]>;

    constructor(sideIds: SideId[], clients: Client[]) {
        this._sideIds = [...sideIds];

        this._sideIdToClient = new Map<SideId, Client>();
        this._clientIdToSideId = new Map<ClientId, SideId>();
        this._sideIdToMessageQueue = new Map<SideId, ServerToClientMessage[]>();

        clients.forEach((client) => {
            const { sideId } = client;
            if (sideId) {
                this._sideIdToClient.set(sideId, client);

                const side = sideIds.find((id) => sideId === id);
                if (!side) {
                    throw new Error(
                        `Client '${client.id}' has side '${sideId}', but that side was not found: ${sideIds.join("|")}`
                    );
                }
                this._clientIdToSideId.set(client.id, side);
            }
        });
    }

    getClientForSide(sideId: SideId): Client {
        const client = this._sideIdToClient.get(sideId);
        if (!client) {
            throw new Error(`Client not found for side ${sideId}`);
        }
        return client;
    }

    pauseMessageSending(sideIds: SideId | SideId[]): void {
        for (const sideId of Misc.CastToArray(sideIds)) {
            if (!this._sideIdToMessageQueue.has(sideId)) {
                this._sideIdToMessageQueue.set(sideId, []);
            }
        }
    }

    resumeMessageSending(sideIds: SideId | SideId[]): void {
        for (const sideId of Misc.CastToArray(sideIds)) {
            const messageQueue = this._sideIdToMessageQueue.get(sideId);
            this._sideIdToMessageQueue.delete(sideId);

            messageQueue?.forEach((message) => this.send(message, sideId));
        }
    }

    send(
        messages: ServerToClientMessage | ServerToClientMessage[],
        sideIds: SideId | SideId[] = this._sideIds,
        bypassQueuing = false
    ): void {
        for (const sideId of Misc.CastToArray(sideIds)) {
            if (!bypassQueuing) {
                const messageQueue = this._sideIdToMessageQueue.get(sideId);
                if (messageQueue !== undefined) {
                    messageQueue.push(...Misc.CastToArray(messages));
                    continue;
                }
            }

            const client = this.getClientForSide(sideId);

            for (const message of Misc.CastToArray(messages)) {
                client.sendMessage(message);
            }
        }
    }

    sendIfVisible(
        messages: ServerToClientMessage | ServerToClientMessage[],
        tilePos: TilePos,
        sideIds: SideId | SideId[] = this._sideIds,
        bypassQueuing = false
    ) {
        for (const sideId of Misc.CastToArray(sideIds)) {
            console.info("Check if", tilePos, "is visible to", sideId, "ASSUMING YES!");

            this.send(messages, sideId, bypassQueuing);
        }
    }

    broadcast(
        messages: ServerToClientMessage | ServerToClientMessage[],
        excludeSideIds: SideId | SideId[] = [],
        bypassQueuing = false
    ): void {
        const includeSideIds =
            excludeSideIds.length === 0
                ? this._sideIds
                : this._sideIds.filter((sideId) => !excludeSideIds.includes(sideId));

        this.send(messages, includeSideIds, bypassQueuing);
    }
}
