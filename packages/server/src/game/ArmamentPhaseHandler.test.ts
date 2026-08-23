import { describe, expect, it, vi } from "vitest";
import { Phase } from "@atbs/shared-data";
import { ArmamentPhaseHandler } from "./phaseHandlers/ArmamentPhaseHandler.js";
import type { Game } from "./Game.js";

function createGame(armingSideIds: string[]) {
    const sides = [
        {
            id: "goodies",
            needsArmamentPhase: armingSideIds.includes("goodies"),
            toSummary: () => ({ id: "goodies", name: "Goodies", victoryPoints: 0 })
        },
        {
            id: "baddies",
            needsArmamentPhase: armingSideIds.includes("baddies"),
            toSummary: () => ({ id: "baddies", name: "Baddies", victoryPoints: 0 })
        }
    ];

    const clients = [
        {
            sideId: "goodies",
            sendMessage: vi.fn()
        },
        {
            sideId: "baddies",
            sendMessage: vi.fn()
        }
    ];

    const game = {
        id: "ARM-TEST",
        needsArmamentPhase: armingSideIds.length > 0,
        sides,
        clients,
        getSide: (sideId: string) => sides.find((side) => side.id === sideId),
        nextPhase: vi.fn(),
        broadcastMessage: vi.fn()
    };

    return { game: game as unknown as Game, clients, nextPhase: game.nextPhase };
}

describe("ArmamentPhaseHandler", () => {
    it("does not advance until every manual side ends", async () => {
        const { game, nextPhase } = createGame(["goodies", "baddies"]);
        const handler = new ArmamentPhaseHandler(game);

        expect(handler.phase).toBe(Phase.enum.armament);

        const handles: Array<{
            type: string;
            handler: (
                context: { game: Game },
                payload: null,
                client: { sideId: string }
            ) => Promise<void>;
        }> = [];
        const messageManager = {
            registerHandler: (
                type: string,
                fn: (
                    context: { game: Game },
                    payload: null,
                    client: { sideId: string }
                ) => Promise<void>
            ) => {
                handles.push({ type, handler: fn });
                return { type };
            }
        };

        handler.registerMessageHandlers(messageManager as never);

        const end = handles.find((handle) => handle.type === "client:armament:end");
        expect(end).toBeDefined();

        await end!.handler({ game }, null, { sideId: "goodies" });
        expect(nextPhase).not.toHaveBeenCalled();

        await end!.handler({ game }, null, { sideId: "baddies" });
        expect(nextPhase).toHaveBeenCalledOnce();
    });
});
