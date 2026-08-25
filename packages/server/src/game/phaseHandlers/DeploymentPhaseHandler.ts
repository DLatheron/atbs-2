import { Phase, SideId, WaitingFor } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager, Game } from "../Game.js";

export class DeploymentPhaseHandler extends PhaseHandler {
    private readonly _deployingSideIds: SideId[];
    private readonly _waitingSideIds: SideId[];

    get phase(): Phase {
        return Phase.enum.deployment;
    }

    constructor(game: Game) {
        super(game);

        if (!game.needsDeploymentPhase) {
            throw new Error(`Game ${game.id} does not need an deployment phase`);
        }

        this._deployingSideIds = [];
        this._waitingSideIds = [];

        for (const side of game.sides) {
            if (side.needsDeploymentPhase) {
                this._deployingSideIds.push(side.id);
            } else {
                this._waitingSideIds.push(side.id);
            }
        }
    }

    async initialise() {
        this.game.broadcastMessage({
            type: "server:phase",
            payload: { phase: Phase.enum.deployment }
        });

        this.sendWaitMessageToWaitingClient();
    }

    sideIdCompleted(clientSideId: SideId) {
        const index = this._deployingSideIds.findIndex((sideId) => sideId === clientSideId);
        if (index >= 0) {
            this._deployingSideIds.splice(index, 1);
        }

        this._waitingSideIds.push(clientSideId);

        this.sendWaitMessageToWaitingClient();
    }

    sendWaitMessageToWaitingClient() {
        const waitingFor: WaitingFor = {
            phase: this.phase,
            sides: this._deployingSideIds.map((sideId) => this.game.getSide(sideId).toSummary())
        };

        for (const client of this.game.clients) {
            const { sideId } = client;
            if (!sideId) {
                throw new Error("Client does not have a set side ID");
            }

            const side = this.game.getSide(sideId);

            if (sideId && this.game.getSide(sideId).needsDeploymentPhase) {
                client.sendMessage({
                    type: "server:map",
                    payload: this.game.map.renderDeploymentMap()
                });
                client.sendMessage({
                    type: "server:deployment:markers",
                    payload: {
                        marker: side.deploymentMarker,
                        deploymentZones: side.toDeploymentZoneSummary()
                    }
                });
                client.sendMessage({
                    type: "server:deployment:side:start",
                    payload: { side: side.toSummary() }
                });
            }

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
                "client:deployment:end",
                ({ game }, _payload, client) => {
                    const { sideId: clientSideId } = client;
                    if (!clientSideId) {
                        throw new Error("Client does not have a set side ID");
                    }

                    this.sideIdCompleted(clientSideId);

                    if (this._deployingSideIds.length === 0) {
                        game.nextPhase();
                    }
                }
            )
        ];
    }
}
