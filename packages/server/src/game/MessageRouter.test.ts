import { beforeEach, describe, expect, vi } from "vitest";
import { ServerToClientMessage, SideId } from "@atbs/shared-data";
import { Client } from "./Client.js";

import { MessageRouter } from "./MessageRouter.js";
import { Game } from "./Game.js";
// import { Client } from "./Client.js";

// vi.mock(import("./Client.js"), () => {
//     const Client = vi.fn(
//         class {
//             id: string;
//             name: string;
//             sideId: SideId | null;

//             constructor({ id, name }: { id: ClientId; name: string }, sideId: SideId | null) {
//                 console.info("Client", id, sideId);
//                 this.id = id;
//                 this.name = name;
//                 this.sideId = sideId;
//             }

//             sendMessage(message: ServerToClientMessage) {
//                 console.info(message);
//             }
//         }
//     );
//     return { Client };
// });

describe("MessageRouter", () => {
    let router: MessageRouter;
    let game: Game;
    let sideIds: SideId[];
    let clients: Client[];
    let messages: ServerToClientMessage[];

    beforeEach(() => {
        game = vi.mocked(Game);

        sideIds = ["side-0", "side-1"];
        clients = [
            new Client({ id: "client-0", name: "Client 0" }, game),
            new Client({ id: "client-1", name: "Client 1" }, game)
        ];
        clients[0].sideId = "side-0";
        clients[1].sideId = "side-1";

        vi.spyOn(clients[0], "sendMessage").mockReturnValue();
        vi.spyOn(clients[1], "sendMessage").mockReturnValue();

        messages = [
            {
                type: "server:hello",
                payload: { gameId: "game-0" }
            },
            {
                type: "server:hello",
                payload: { gameId: "game-1" }
            },
            {
                type: "server:hello",
                payload: { gameId: "game-2" }
            },
            {
                type: "server:hello",
                payload: { gameId: "game-3" }
            },
            {
                type: "server:hello",
                payload: { gameId: "game-4" }
            }
        ];
        
        router = new MessageRouter(sideIds, clients);
    });

    describe("getClientForSide", () => {
        it("should correctly map the client to the side", () => {
            expect(router.getClientForSide("side-0")).toBe(clients[0]);
            expect(router.getClientForSide("side-1")).toBe(clients[1]);
        });
    });
    
    describe("sendMessage", () => {
        it("should send a message to the correct client for the side", () => {
            router.sendMessage(messages[0], "side-0");

            expect(clients[0].sendMessage).toHaveBeenCalledWith(messages[0]);
            expect(clients[0].sendMessage).toHaveBeenCalledTimes(1);
            expect(clients[1].sendMessage).not.toHaveBeenCalled();

            vi.spyOn(clients[0], "sendMessage").mockReset();
            vi.spyOn(clients[1], "sendMessage").mockReset();

            router.sendMessage(messages[1], "side-1");

            expect(clients[1].sendMessage).toHaveBeenCalledWith(messages[1]);
            expect(clients[1].sendMessage).toHaveBeenCalledTimes(1);
            expect(clients[0].sendMessage).not.toHaveBeenCalled();
        });

        it("should pause message sending when requested (unless bypassing the queuing)", () => {
            router.pauseMessageSending("side-0");

            router.sendMessage(messages[0], "side-0");
            router.sendMessage(messages[1], "side-0");

            router.sendMessage(messages[3], "side-1");

            // Next message should bypass queuing.
            router.sendMessage(messages[2], "side-0", true);

            expect(clients[0].sendMessage).toHaveBeenNthCalledWith(1, messages[2]);
            expect(clients[0].sendMessage).toHaveBeenCalledTimes(1);
            expect(clients[1].sendMessage).toHaveBeenCalledWith(messages[3]);
            expect(clients[1].sendMessage).toHaveBeenCalledTimes(1);

            router.resumeMessageSending("side-0");

            expect(clients[0].sendMessage).toHaveBeenNthCalledWith(2, messages[0]);
            expect(clients[0].sendMessage).toHaveBeenNthCalledWith(3, messages[1]);
            expect(clients[0].sendMessage).toHaveBeenCalledTimes(3);
            expect(clients[1].sendMessage).toHaveBeenCalledWith(messages[3]);
            expect(clients[1].sendMessage).toHaveBeenCalledTimes(1);

            router.sendMessage(messages[4], "side-0");
            expect(clients[0].sendMessage).toHaveBeenNthCalledWith(4, messages[4]);
            expect(clients[0].sendMessage).toHaveBeenCalledTimes(4);
            expect(clients[1].sendMessage).toHaveBeenCalledWith(messages[3]);
            expect(clients[1].sendMessage).toHaveBeenCalledTimes(1);
        });
    });

    describe("broadcastMessage", () => {
        it("should send it to client", () => {
            router.broadcastMessage(messages[0]);

            expect(clients[0].sendMessage).toHaveBeenCalledWith(messages[0]);
            expect(clients[0].sendMessage).toHaveBeenCalledTimes(1);
            expect(clients[1].sendMessage).toHaveBeenCalledWith(messages[0]);
            expect(clients[1].sendMessage).toHaveBeenCalledTimes(1);
        });

        it("should send it to clients that are not excluded", () => {
            router.broadcastMessage(messages[0], "side-0");

            expect(clients[0].sendMessage).not.toHaveBeenCalled();
            expect(clients[1].sendMessage).toHaveBeenCalledWith(messages[0]);
            expect(clients[1].sendMessage).toHaveBeenCalledTimes(1);
        });

        it("should not send any messages if all clients are excluded", () => {
            router.broadcastMessage(messages[0], ["side-0", "side-1"]);

            expect(clients[0].sendMessage).not.toHaveBeenCalled();
            expect(clients[1].sendMessage).not.toHaveBeenCalled();
        });
    });
});
