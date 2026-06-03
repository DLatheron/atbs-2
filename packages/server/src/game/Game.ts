import { randomInt } from "node:crypto";
import {
    ClientId,
    ClientToServerMessage,
    GameId,
    Phase,
    ServerToClientMessage,
    SideId
} from "@atbs/shared-data";

import { Client } from "./Client.js";
import { ClientManager } from "./ClientManager.js";
import type { PhaseHandler } from "./phaseHandlers/PhaseHandler.js";
import { LobbyPhaseHandler } from "./phaseHandlers/LobbyPhaseHandler.js";
import { ArmamentPhaseHandler } from "./phaseHandlers/ArmamentPhaseHandler.js";
import { DeploymentPhaseHandler } from "./phaseHandlers/DeploymentPhaseHandler.js";
import { CastToArray, MessageManager } from "@atbs/misc";
import { Scenario } from "./Scenario.js";
import { ScenarioManager } from "./ScenarioManager.js";
import { Side } from "./Side.js";
import { ActionPhaseHandler } from "./phaseHandlers/ActionPhaseHandler.js";
import { WorldMap } from "./WorldMap.js";

const FIXED_GAME_ID = true; // Temporary Hack.

const GAME_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomSegment(length: number): string {
    let segment = "";
    for (let i = 0; i < length; i++) {
        segment += GAME_ID_CHARS[randomInt(GAME_ID_CHARS.length)];
    }
    return segment;
}

function generateGameId(): string {
    if (FIXED_GAME_ID) {
        return "AAAA-AAAA";
    } else {
        return `${randomSegment(4)}-${randomSegment(4)}`;
    }
}

interface ClientMessageContext {
    game: Game;
}

export type ClientMessageManager = MessageManager<
    ClientMessageContext,
    ClientToServerMessage,
    Client
>;

export class Game {
    private readonly _scenarioManager: ScenarioManager;

    private _ownerId: ClientId;
    private readonly _id: GameId;
    private readonly _clientManager: ClientManager;
    private readonly _context: ClientMessageContext;
    private readonly _messageManager: ClientMessageManager;

    private _phaseHandler: PhaseHandler;
    private _scenario: Scenario | null;

    private readonly _playState: {
        sides: Side[];
        turn: number;
    };

    constructor(ownerId: ClientId, scenarioManager: ScenarioManager) {
        this._scenarioManager = scenarioManager;
        this._ownerId = ownerId;
        this._id = generateGameId();
        this._clientManager = new ClientManager();

        this._context = { game: this };
        this._messageManager = new MessageManager<
            ClientMessageContext,
            ClientToServerMessage,
            Client
        >(this._context);

        this._registerMessageHandlers();

        this._phaseHandler = new LobbyPhaseHandler(this);
        this._phaseHandler.registerMessageHandlers(this._messageManager);

        this._scenario = null;
        this._playState = {
            sides: [],
            turn: 0
        };
    }

    get id(): GameId {
        return this._id;
    }

    get phase(): Phase {
        return this._phaseHandler.phase;
    }

    private async setPhase(phase: Phase) {
        if (this._phaseHandler) {
            await this._phaseHandler.uninitialise();

            this._phaseHandler.unregisterMessageHandlers(this._messageManager);
        }

        switch (phase) {
            case Phase.enum.lobby:
                this._phaseHandler = new LobbyPhaseHandler(this);
                break;

            case Phase.enum.armament:
                this._phaseHandler = new ArmamentPhaseHandler(this);
                break;

            case Phase.enum.deployment:
                this._phaseHandler = new DeploymentPhaseHandler(this);
                break;

            case Phase.enum.action:
                this._phaseHandler = new ActionPhaseHandler(this);
                break;

            default:
                throw new Error(`Unexpected phase ${phase}`);
        }

        this._phaseHandler.initialise();

        this._phaseHandler.registerMessageHandlers(this._messageManager);
    }

    get sides(): Side[] {
        if (!this._scenario) {
            throw new Error("No scenario set");
        }

        return this._scenario.sides;
    }

    get needsArmamentPhase() {
        if (!this._scenario) {
            throw new Error("No scenario set");
        }

        return this._scenario.needsArmamentPhase;
    }

    get needsDeploymentPhase() {
        if (!this._scenario) {
            throw new Error("No scenario set");
        }

        return this._scenario.needsDeploymentPhase;
    }

    get worldMap(): WorldMap {
        if (!this._scenario) {
            throw new Error("No scenario set");
        }

        return this._scenario.worldMap;
    }

    async nextPhase(): Promise<Phase> {
        const { phase: currentPhase } = this._phaseHandler;
        let newPhase: Phase;

        switch (currentPhase) {
            case Phase.enum.main_menu:
                newPhase = Phase.enum.lobby;
                break;

            case Phase.enum.lobby:
                if (this.needsArmamentPhase) {
                    newPhase = Phase.enum.armament;
                } else if (this.needsDeploymentPhase) {
                    newPhase = Phase.enum.deployment;
                } else {
                    newPhase = Phase.enum.action;
                }
                break;

            case Phase.enum.armament:
                if (this.needsDeploymentPhase) {
                    newPhase = Phase.enum.deployment;
                } else {
                    newPhase = Phase.enum.action;
                }
                break;

            case Phase.enum.deployment:
                newPhase = Phase.enum.action;
                break;

            case Phase.enum.action:
                newPhase = Phase.enum.game_over;
                break;

            case Phase.enum.game_over:
                newPhase = Phase.enum.main_menu;
                break;

            default:
                throw new Error(`Unsupported phase ${currentPhase} in nextPhase call`);
        }

        await this.setPhase(newPhase);

        return newPhase;
    }

    private _registerMessageHandlers() {
        this._messageManager.registerHandler("client:ping", () => {
            // console.dir({ handler: "client:ping", context, payload, from });
        });
    }

    // private _unregisterMessageHandlers() {
    //     this._messageManager.unregisterHandler("client:ping");
    // }

    get ownerId(): ClientId {
        return this._ownerId;
    }

    get owner(): Client {
        return this._clientManager.getClient(this.ownerId);
    }

    get gameId(): GameId {
        return this._id;
    }

    get clients(): Client[] {
        return this._clientManager.clients;
    }

    get numClients(): number {
        return this.clients.length;
    }

    get scenario(): Scenario | null {
        return this._scenario;
    }

    get scenarioManager(): ScenarioManager {
        return this._scenarioManager;
    }

    set scenario(value: Scenario | null) {
        if (this.phase !== Phase.enum.lobby) {
            throw new Error(`Scenario cannot be changed whilst in ${this.phase} phase`);
        }

        if (this._scenario !== value) {
            this._scenario = value;

            // Clear any assigned sides.
            for (const client of this.clients) {
                client.sideId = null;
                client.ready = false;
            }
        }
    }

    get availableSideIds(): SideId[] {
        return this.scenario
            ? this.scenario.sides
                  .map(({ id }) => id)
                  .filter((id) => !this.clients.find(({ sideId }) => sideId === id))
            : [];
    }

    get canStartGame(): boolean {
        return (
            !!this.scenario &&
            this.availableSideIds.length === 0 &&
            this.clients.every((client) => client.sideId === null || client.ready)
        );
    }

    reportError(error: string) {
        console.error(error);
    }

    /**
     * Add a client to the game (if possible).
     * Returns the `Client` is successful, otherwise `null`.
     */
    addClient(clientId: ClientId, name: string): Client | null {
        if (!this._phaseHandler.acceptingClients) {
            this.reportError(
                `Game ${this.gameId} is in a phase that is not accepting new clients: ${this.phase}`
            );
            return null;
        }

        const existingClient = this._clientManager.findClient(clientId);
        if (existingClient) {
            this.reportError(`Client ${clientId} is already in game ${this.gameId}`);
            return existingClient;
        }

        const client = new Client({ id: clientId, name }, this);
        this._clientManager.addClient(client);

        return client;
    }

    /**
     * Remove a client from the game (if it exists).
     * Returns `true` if the client was removed, otherwise `false`.
     */
    removeClient(clientId: ClientId): boolean {
        return this._clientManager.removeClient(clientId);
    }

    getClient(clientId: ClientId) {
        return this._clientManager.getClient(clientId);
    }

    findClient(clientId: ClientId): Client | undefined {
        return this._clientManager.findClient(clientId);
    }

    clientConnected(client: Client): void {
        // Tell the client what mode they should be in...
        client.sendMessage({
            type: "server:phase",
            payload: { phase: this.phase }
        });

        this._phaseHandler.clientConnected(client);
    }

    clientDisconnected(client: Client): void {
        this._phaseHandler.clientDisconnected(client);
    }

    getSide(sideId: SideId): Side {
        if (!this._scenario) {
            throw new Error(`Game ${this.gameId} does not have a scenario`);
        }

        return this._scenario.getSide(sideId);
    }

    sendMessage(message: ServerToClientMessage, to: ClientId | ClientId[]) {
        const clients = CastToArray(to).map((clientId) => this.getClient(clientId));

        clients.forEach((client) => client.sendMessage(message));
    }

    broadcastMessage(message: ServerToClientMessage, exclude?: ClientId | ClientId[]) {
        const excludes = exclude ? CastToArray(exclude) : [];

        console.info("Broadcasting", message.type, "excluding", excludes);

        for (const client of this._clientManager.clients) {
            if (!excludes.includes(client.id)) {
                client.sendMessage(message);
            }
        }
    }

    queueMessage(message: ClientToServerMessage, from: Client) {
        this._messageManager.enqueueMessage(message, from);
    }

    receiveMessage(data: MessageEvent, from: Client) {
        const messageString = data.toString();
        const message = ClientToServerMessage.parse(JSON.parse(messageString));

        this.queueMessage(message, from);
    }

    destroyGame() {
        console.info("DDD Destroying game", this.gameId);

        while (this.clients.length > 0) {
            const client = this.clients[0];

            client.forceDisconnect();

            this.removeClient(client.id);
        }
    }

    get turn(): number {
        if (this._playState.turn === 0) {
            throw new Error("Action phase has not been started");
        }

        return this._playState.turn;
    }

    get turnsSide(): Side {
        if (this._playState.sides.length === 0) {
            throw new Error("No side currently playing");
        }

        return this._playState.sides[0];
    }

    startActionPhase(): void {
        this._playState.turn = 1;
    }

    startSide(): void {
        const playingClient = this.clients.find(({ sideId }) => this.turnsSide.id === sideId);
        if (!playingClient) {
            throw new Error("Didn't find expected client");
        }

        this.broadcastMessage(
            {
                type: "server:wait",
                payload: {
                    phase: "action",
                    sides: [this.turnsSide.toSummary()]
                }
            },
            playingClient.id
        );

        playingClient.sendMessage({
            type: "server:unit",
            payload: {
                id: "captain-smith.unit"
            }
        });
        playingClient.sendMessage({
            type: "server:map",
            payload: this.worldMap.renderClientMap()
        });
        playingClient.sendMessage({
            type: "server:wait",
            payload: null
        });
    }

    startTurn(): void {
        const { turn } = this;

        console.info(`Starting turn: ${turn}`);

        this._playState.sides = [...this.sides];

        this.startSide();
    }

    endTurn(): void {
        const { turn } = this;

        console.info(`Ending turn: ${turn}`);

        const playingClient = this.clients.find(({ sideId }) => this.turnsSide.id === sideId);
        if (!playingClient) {
            throw new Error("Didn't find expected client");
        }
    }

    nextSide(): boolean {
        if (this._playState.sides.length === 1) {
            this.endTurn();
            this._playState.turn++;
            this.startTurn();

            return true;
        }

        this._playState.sides.shift();
        
        console.info(`Side '${this.turnsSide.name}' to play`);

        this.startSide();

        return false;
    }
}
