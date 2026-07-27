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
import { gameManager } from "./GameManager.js";
import type { PhaseHandler } from "./phaseHandlers/PhaseHandler.js";
import { LobbyPhaseHandler } from "./phaseHandlers/LobbyPhaseHandler.js";
import { ArmamentPhaseHandler } from "./phaseHandlers/ArmamentPhaseHandler.js";
import { DeploymentPhaseHandler } from "./phaseHandlers/DeploymentPhaseHandler.js";
import { CastToArray, Logger, MessageManager } from "@atbs/misc";
import { Scenario } from "./Scenario.js";
import { ScenarioRecipeManager } from "./ScenarioRecipeManager.js";
import { Side } from "./Side.js";
import { ActionPhaseHandler } from "./phaseHandlers/ActionPhaseHandler.js";
import { WorldMap } from "./WorldMap.js";
import { Unit } from "./Unit.js";
import { MessageRouter } from "./MessageRouter.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { FurnitureManager } from "./FurnitureManager.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { DamageCacheManager } from "./DamageCacheManager.js";
import { ImageManager } from "./ImageManager.js";
import { config } from "../config/config.schema.js";
import { VisibilityManager } from "./VisibilityManager.js";
import { DebugGraphic } from "@atbs/maths";
import { VfxRecipeManager } from "./VfxRecipeManager.js";
import { VfxManager } from "./VfxManager.js";

const GAME_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomSegment(length: number): string {
    let segment = "";
    for (let i = 0; i < length; i++) {
        segment += GAME_ID_CHARS[randomInt(GAME_ID_CHARS.length)];
    }
    return segment;
}

function generateGameId(): string {
    return `${randomSegment(4)}-${randomSegment(4)}`;
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
    readonly logger: Logger;

    private readonly _scenarioRecipeManager: ScenarioRecipeManager;

    private _ownerId: ClientId;
    private readonly _id: GameId;
    private readonly _clientManager: ClientManager;
    private readonly _context: ClientMessageContext;
    private readonly _messageManager: ClientMessageManager;
    private readonly _itemManager: ItemManager;
    private readonly _furnitureManager: FurnitureManager;
    private readonly _damageCacheManager: DamageCacheManager;
    private readonly _visibilityManager: VisibilityManager;
    private readonly _vfxRecipeManager: VfxRecipeManager;
    private readonly _vfxManager: VfxManager;

    private _messageRouter: MessageRouter | null;
    private _phaseHandler: PhaseHandler;
    private _scenario: Scenario | null;
    private _isDestroying = false;

    private readonly _playState: {
        sides: Side[];
        turn: number;
        selectedUnit: Unit | null;
    };

    constructor(
        ownerId: ClientId,
        scenarioRecipeManager: ScenarioRecipeManager,
        itemRecipeManager: ItemRecipeManager,
        furnitureRecipeManager: FurnitureRecipeManager,
        vfxRecipeManager: VfxRecipeManager,
        materialManager: MaterialManager
    ) {
        const gameId = generateGameId();

        this.logger = new Logger(`Game-${gameId}`, config.logLevels?.game);

        this._scenarioRecipeManager = scenarioRecipeManager;
        this._id = gameId;
        this._ownerId = ownerId;
        this._clientManager = new ClientManager();
        this._itemManager = new ItemManager(itemRecipeManager);
        this._furnitureManager = new FurnitureManager(furnitureRecipeManager, materialManager);
        this._damageCacheManager = new DamageCacheManager(gameId);
        this._visibilityManager = new VisibilityManager(this);
        this._vfxRecipeManager = vfxRecipeManager;
        this._vfxManager = new VfxManager(this);

        this._context = { game: this };
        this._messageManager = new MessageManager<
            ClientMessageContext,
            ClientToServerMessage,
            Client
        >(this._context);

        this._registerMessageHandlers();

        this._messageRouter = null;
        this._phaseHandler = new LobbyPhaseHandler(this);
        this._phaseHandler.registerMessageHandlers(this._messageManager);

        this._scenario = null;
        this._playState = {
            sides: [],
            turn: 0,
            selectedUnit: null
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
                this._messageRouter = new MessageRouter(
                    this.sides.map(({ id }) => id),
                    this.clients
                );
                this._phaseHandler = new ArmamentPhaseHandler(this);
                break;

            case Phase.enum.deployment:
                this._messageRouter = new MessageRouter(
                    this.sides.map(({ id }) => id),
                    this.clients
                );
                this._phaseHandler = new DeploymentPhaseHandler(this);
                break;

            case Phase.enum.action:
                this._messageRouter = new MessageRouter(
                    this.sides.map(({ id }) => id),
                    this.clients
                );
                this._phaseHandler = new ActionPhaseHandler(this);
                break;

            default:
                throw new Error(`Unexpected phase ${phase}`);
        }

        this._phaseHandler.initialise();

        this._phaseHandler.registerMessageHandlers(this._messageManager);
    }

    get messageRouter(): MessageRouter {
        if (!this._messageRouter) {
            throw new Error("No message router set");
        }

        return this._messageRouter;
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

    get map(): WorldMap {
        if (!this._scenario) {
            throw new Error("No scenario set");
        }

        return this._scenario.map;
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
            // this.logger.dir({ handler: "client:ping", context, payload, from });
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

    get scenarioRecipeManager(): ScenarioRecipeManager {
        return this._scenarioRecipeManager;
    }

    get itemManager(): ItemManager {
        return this._itemManager;
    }

    get furnitureManager(): FurnitureManager {
        return this._furnitureManager;
    }

    get damageCacheManager(): DamageCacheManager {
        return this._damageCacheManager;
    }

    get visibilityManager(): VisibilityManager {
        return this._visibilityManager;
    }

    get vfxManager(): VfxManager {
        return this._vfxManager;
    }

    get vfxRecipeManager(): VfxRecipeManager {
        return this._vfxRecipeManager;
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
        this.logger.error(error);
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
        const removed = this._clientManager.removeClient(clientId);

        if (removed && this.numClients === 0 && !this._isDestroying) {
            this.destroyGame();
            gameManager.removeGame(this.gameId);
        }

        return removed;
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

        this.logger.info("Broadcasting", message.type, "excluding", excludes);

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

        try {
            const message = ClientToServerMessage.parse(JSON.parse(messageString));

            this.queueMessage(message, from);
        } catch (error) {
            this.logger.error("Issue decoding message", messageString);
            throw error;
        }
    }

    destroyGame() {
        if (this._isDestroying) {
            return;
        }

        this._isDestroying = true;
        this.logger.info("DDD Destroying game", this.gameId);

        if (config.cleanupDamageCacheOnGameDestroy) {
            this._damageCacheManager.cleanup(ImageManager.GetSingleton());
        }

        while (this.clients.length > 0) {
            const client = this.clients[0];

            client.forceDisconnect();

            this._clientManager.removeClient(client.id);
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

    get turnsSideId(): SideId {
        return this.turnsSide.id;
    }

    get oppositionSideIds(): SideId[] {
        return this.turnsSide.oppositionSideIds;
    }

    get selectedUnit(): Unit | null {
        return this._playState.selectedUnit;
    }

    set selectedUnit(value: Unit | null) {
        const { selectedUnit } = this;

        if (selectedUnit === value) {
            return;
        }

        if (selectedUnit) {
            this.logger.info("Deselect unit", selectedUnit.name);

            selectedUnit.deselect();
        }

        if (value) {
            this.logger.info("Selecting unit", value.name);

            if (selectedUnit) {
                selectedUnit.select();
            }
        }

        this._playState.selectedUnit = value;
    }

    getUnitsForSide(sideId: SideId): Unit[] {
        return this.getSide(sideId).units;
    }

    getOppositionUnitsForSide(sideId: SideId): Unit[] {
        return this.getSide(sideId)
            .oppositionSideIds.map((oppositionSideId) => this.getSide(oppositionSideId).units)
            .flat();
    }

    startActionPhase(): void {
        this._playState.turn = 1;
        this.selectedUnit = null;

        // Place units into the map.
        this.sides.forEach((side) =>
            side.units.forEach((unit) => {
                this.map.addUnit(unit);
            })
        );

        if (config.showVisibilityDebugGraphics) {
            const debugGraphics: DebugGraphic[] = [];
            this.visibilityManager.update(undefined, debugGraphics);
            if (debugGraphics.length > 0) {
                this.messageRouter.broadcast(
                    {
                        type: "server:debug:graphics",
                        payload: debugGraphics
                    },
                    [],
                    true
                );
            }
        } else {
            this.visibilityManager.update();
        }

        // Seed each unit's canSee from the initial visibility pass so selection
        // summaries are correct before anyone has moved.
        this.syncUnitsCanSee();

        this.messageRouter.broadcast(
            {
                type: "server:map",
                payload: this.map.renderClientMap()
            },
            [],
            true
        );
    }

    /**
     * Recomputes every unit's `canSee` from the current VisibilityManager state.
     * `visibilityManager.update()` refreshes LOS for all viewers, so canSee must
     * be synced for all units — not just the one that triggered the refresh —
     * otherwise an opposition unit that newly sees someone still reports 0 when
     * selected later.
     */
    syncUnitsCanSee(): void {
        for (const side of this.sides) {
            for (const unit of side.units) {
                unit.canSee = unit.getVisibleUnits();
            }
        }
    }

    startTurn(): void {
        const { turn } = this;

        this.logger.info(`Starting turn: ${turn}`);

        this.messageRouter.broadcast(
            {
                type: "server:turn:start",
                payload: { turn }
            },
            [],
            true
        );

        // this.messageRouter.broadcast(
        //     {
        //         type: "server:debug:graphics",
        //         payload: [
        //             {
        //                 type: DebugGraphicType.enum.path,
        //                 segments: [
        //                     { pos: { x: 100, y: 100 }, time: 0 },
        //                     { pos: { x: 1100, y: 100 }, time: 10000 },
        //                     { pos: { x: 1100, y: 1100 }, time: 20000 },
        //                     { pos: { x: 100, y: 1100 }, time: 30000 },
        //                     { pos: { x: 100, y: 100 }, time: 40000 }
        //                 ],
        //                 strokeColour: Colour.White,
        //                 strokeThickness: 2,
        //                 trail: [0, -100, -10000]
        //             }
        //         ]
        //     },
        //     [],
        //     true
        // );

        this._playState.sides = [...this.sides];
        this.selectedUnit = null;

        this.startSide();
    }

    startSide(): void {
        // Make non-playing sides display the waiting modal.
        this.messageRouter.send(
            {
                type: "server:wait",
                payload: {
                    phase: "action",
                    sides: [this.turnsSide.toSummary()]
                }
            },
            this.oppositionSideIds,
            true
        );

        // Make the playing side start the side, disable their UI and clear their waiting model.
        // Intentionally do NOT send `server:visible:tiles` here: the queued playback
        // from the previous side already contains interleaved visibility updates that
        // stay in sync with each map change. Sending the final set first would be
        // immediately overwritten by those historical intermediate sets and cause
        // units to flicker in and out during playback.
        this.messageRouter.send(
            [
                {
                    type: "server:side:start",
                    payload: { side: this.turnsSide.toSummary() }
                },
                {
                    type: "server:wait",
                    payload: null
                },
                {
                    type: "server:ui:disabled",
                    payload: true
                }
            ],
            this.turnsSideId,
            true
        );

        // Playback any queued message.
        this.messageRouter.pauseMessageSending(this.oppositionSideIds);
        this.messageRouter.resumeMessageSending(this.turnsSideId);

        // Final visibility sync (covers empty queues / actions that don't broadcast)
        // then re-enable the playing side's UI.
        this.messageRouter.send(
            [
                {
                    type: "server:visible:tiles",
                    payload: this.visibilityManager.getVisibilityUpdate(
                        this.turnsSide.oppositionSideIds
                    )
                },
                {
                    type: "server:ui:disabled",
                    payload: false
                }
            ],
            this.turnsSideId
        );

        this.turnsSide.units.forEach((unit) => unit.startTurn());
    }

    endTurn(): void {
        const { turn } = this;

        this.logger.info(`Ending turn: ${turn}`);

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

        this.logger.info(`Side '${this.turnsSide.name}' to play`);

        this.startSide();

        return false;
    }

    verifyFromPlayingClient(from: Client): void | never {
        if (from.id !== this.messageRouter.getClientForSide(this.turnsSide.id).id) {
            throw new Error(
                `Message from client '${from.name}' (${from.id}) is unexpected - not their turn (${this.turnsSide.name})`
            );
        }
    }
}
