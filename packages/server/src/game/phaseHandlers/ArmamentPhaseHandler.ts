import { Phase, SideId, WaitingFor } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager, Game } from "../Game.js";

export class ArmamentPhaseHandler extends PhaseHandler {
    private readonly _armingSideIds: SideId[];
    private readonly _waitingSideIds: SideId[];

    get phase(): Phase {
        return Phase.Enum.armament;
    }

    constructor(game: Game) {
        super(game);

        if (!game.needsArmamentPhase) {
            throw new Error(`Game ${game.id} does not need an armament phase`);
        }

        this._armingSideIds = [];
        this._waitingSideIds = [];

        for (const side of game.sides) {
            if (side.needsArmamentPhase) {
                this._armingSideIds.push(side.id);
            } else {
                this._waitingSideIds.push(side.id);
            }
        }
    }

    async initialise() {
        this.game.broadcastMessage({
            type: "server:phase",
            payload: { phase: Phase.Enum.armament }
        });

        this.sendWaitMessageToWaitingClient();
    }

    sideIdCompleted(clientSideId: SideId) {
        const index = this._armingSideIds.findIndex((sideId) => sideId === clientSideId);
        if (index >= 0) {
            this._armingSideIds.splice(index, 1);
        }

        this._waitingSideIds.push(clientSideId);

        this.sendWaitMessageToWaitingClient();
    }

    sendWaitMessageToWaitingClient() {
        const waitingFor: WaitingFor = {
            phase: this.phase,
            sides: this._armingSideIds.map((sideId) => ({
                id: sideId,
                name: this.game.getSide(sideId).name
            }))
        };

        for (const client of this.game.clients) {
            const { sideId } = client;

            if (sideId && this._waitingSideIds.includes(sideId)) {
                client.sendMessage({ type: "server:wait", payload: waitingFor });
            } else {
                client.sendMessage({ type: "server:wait", payload: null });
            }
        }
    }

    registerMessageHandlers(messageManager: ClientMessageManager): void {
        this._handlerHandles = [
            messageManager.registerHandler(
                "client:armament:end",
                async ({ game }, _payload, client) => {
                    const { sideId: clientSideId } = client;
                    if (!clientSideId) {
                        throw new Error("Client does not have a set side ID");
                    }

                    this.sideIdCompleted(clientSideId);

                    if (this._armingSideIds.length === 0) {
                        await game.nextPhase();
                    }
                }
            )
        ];
    }
}
