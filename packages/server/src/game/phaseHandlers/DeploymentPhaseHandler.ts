import { Phase, RenderList, RenderMode, SideId, TrackingSpeed, UnitId, WaitingFor } from "@atbs/shared-data";
import { PhaseHandler } from "./PhaseHandler.js";
import type { ClientMessageManager, Game } from "../Game.js";
import { ITilePos, Orientation, TilePos } from "@atbs/maths";
import type { Client } from "../Client.js";
import type { Side } from "../Side.js";

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
                side.units.forEach((unit) => {
                    unit.location = null;
                });

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

    private _requireDeployingSide(client: Client): Side {
        const { sideId } = client;
        if (!sideId) {
            throw new Error("Client does not have a set side ID");
        }
        if (!this._deployingSideIds.includes(sideId)) {
            throw new Error(`Side ${sideId} is not deploying`);
        }
        return this.game.getSide(sideId);
    }

    private _sendDeploymentMarkers(client: Client, side: Side): void {
        client.sendMessage({
            type: "server:deployment:markers",
            payload: {
                marker: side.deploymentMarker,
                deploymentZones: side.toDeploymentZoneSummary(),
                units: side.units.reduce(
                    (acc, unit) => {
                        acc[unit.id] = {
                            location: unit.location,
                            ...(unit.location && {
                                orientation: unit.orientation,
                                mapImage: unit.getRenderList({
                                    renderMode: RenderMode.enum.MAP_MODE,
                                    states: []
                                })
                            })
                        };
                        return acc;
                    },
                    {} as Record<
                        UnitId,
                        {
                            location: ITilePos | null;
                            orientation?: Orientation;
                            mapImage?: RenderList;
                        }
                    >
                ),
                canEndDeployment: side.canEndDeployment,
                endDeploymentBlockedReason: side.endDeploymentBlockedReason
            }
        });
    }

    private _sendCameraToTile(client: Client, tilePos: ITilePos): void {
        client.sendMessage({
            type: "server:camera:move:to",
            payload: {
                target: "tile",
                tilePos,
                trackingSpeed: TrackingSpeed.enum.FAST
            }
        });
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
                this._sendDeploymentMarkers(client, side);
                client.sendMessage({
                    type: "server:deployment:side:start",
                    payload: {
                        side: side.toSummary(),
                        units: side.units.map((unit) => unit.toSummary())
                    }
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
                    const side = this._requireDeployingSide(client);
                    if (!side.canEndDeployment) {
                        throw new Error(
                            `Side ${side.id} cannot end deployment: units or zone minima not satisfied`
                        );
                    }

                    this.sideIdCompleted(side.id);

                    if (this._deployingSideIds.length === 0) {
                        game.nextPhase();
                    }
                }
            ),

            messageManager.registerHandler(
                "client:deployment:deploy",
                (_ctx, payload, client) => {
                    const side = this._requireDeployingSide(client);
                    const tilePos = new TilePos(payload.tilePos);
                    side.deployUnit(payload.unitId, tilePos);
                    this._sendDeploymentMarkers(client, side);
                    this._sendCameraToTile(client, tilePos);
                }
            ),

            messageManager.registerHandler(
                "client:deployment:undeploy",
                (_ctx, payload, client) => {
                    const side = this._requireDeployingSide(client);
                    side.undeployUnit(payload.unitId);
                    this._sendDeploymentMarkers(client, side);
                }
            ),

            messageManager.registerHandler(
                "client:deployment:deploy:random",
                (_ctx, payload, client) => {
                    const side = this._requireDeployingSide(client);
                    const tilePos = side.randomDeployment(payload.unitId);
                    this._sendDeploymentMarkers(client, side);
                    this._sendCameraToTile(client, tilePos);
                }
            ),

            messageManager.registerHandler(
                "client:deployment:deploy:all",
                (_ctx, _payload, client) => {
                    const side = this._requireDeployingSide(client);
                    side.randomDeployAll();
                    this._sendDeploymentMarkers(client, side);
                }
            ),

            messageManager.registerHandler(
                "client:deployment:undeploy:all",
                (_ctx, _payload, client) => {
                    const side = this._requireDeployingSide(client);
                    side.undeployAll();
                    this._sendDeploymentMarkers(client, side);
                }
            ),

            messageManager.registerHandler("client:game:tile:info", ({ game }, payload, from) => {
                const tilePos = new TilePos(payload.tilePos);
                const tile = game.map.getTile(tilePos);

                from.sendMessage({
                    type: "server:game:tile:info",
                    payload: tile.getTileInfo()
                });
            })
        ];
    }
}
