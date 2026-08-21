import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    ClientToServerMessage,
    Phase,
    ServerToClientMessage,
    StoreItemView
} from "@atbs/shared-data";
import type { WebSocket } from "ws";
import { Game } from "./Game.js";
import { FurnitureRecipeManager } from "./FurnitureRecipeManager.js";
import { ImageManager } from "./ImageManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { MapRecipeManager } from "./MapRecipeManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { ScenarioRecipeManager } from "./ScenarioRecipeManager.js";
import { TerrainManager } from "./TerrainManager.js";
import { UnitRecipeManager } from "./UnitRecipeManager.js";
import { VfxRecipeManager } from "./VfxRecipeManager.js";
import { AnimationRecipeManager } from "./AnimationRecipeManager.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data");

/**
 * Minimal stand-in for the `ws` socket: records everything the server sends so a
 * test can assert on the wire format the browser would actually receive.
 */
class FakeSocket {
    readonly readyState = 1;
    readonly sent: ServerToClientMessage[] = [];

    private readonly _listeners = new Map<string, ((data: unknown) => void)[]>();

    send(data: string) {
        this.sent.push(ServerToClientMessage.parse(JSON.parse(data)));
    }

    on(event: string, listener: (data: unknown) => void) {
        this._listeners.set(event, [...(this._listeners.get(event) ?? []), listener]);
        return this;
    }

    removeAllListeners() {
        this._listeners.clear();
        return this;
    }

    close() {
        /* Nothing to do. */
    }

    received(type: ServerToClientMessage["type"]) {
        return this.sent.filter((message) => message.type === type);
    }

    lastReceived<TYPE extends ServerToClientMessage["type"]>(
        type: TYPE
    ): Extract<ServerToClientMessage, { type: TYPE }> {
        const messages = this.received(type);
        const message = messages[messages.length - 1];
        if (!message) {
            throw new Error(
                `No ${type} message received, only: ${[...new Set(this.sent.map(({ type }) => type))].join(", ")}`
            );
        }
        return message as Extract<ServerToClientMessage, { type: TYPE }>;
    }

    emit(event: string, data: unknown) {
        for (const listener of this._listeners.get(event) ?? []) {
            listener(data);
        }
    }
}

async function settle() {
    for (let tick = 0; tick < 20; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

describe("Armament phase", () => {
    let scenarioRecipeManager: ScenarioRecipeManager;
    let itemRecipeManager: ItemRecipeManager;
    let furnitureRecipeManager: FurnitureRecipeManager;
    let vfxRecipeManager: VfxRecipeManager;
    let materialManager: MaterialManager;

    let game: Game | null = null;

    const armingClientId = crypto.randomUUID();
    const waitingClientId = crypto.randomUUID();

    beforeAll(async () => {
        await ImageManager.GetSingleton().loadImages([
            path.join(dataDir, "terrain"),
            path.join(dataDir, "units"),
            path.join(dataDir, "items"),
            path.join(dataDir, "icons"),
            path.join(dataDir, "furniture"),
            path.join(dataDir, "vfx")
        ]);
        await TerrainManager.GetSingleton().loadTerrain(path.join(dataDir, "terrain"));
        materialManager = MaterialManager.GetSingleton();
        await materialManager.loadMaterials(path.join(dataDir, "materials"));
        await MapRecipeManager.GetSingleton().loadWorldMaps(path.join(dataDir, "maps"));
        await UnitRecipeManager.GetSingleton().loadUnitRecipes(path.join(dataDir, "units"));
        await AnimationRecipeManager.GetSingleton().loadAnimationRecipes(
            path.join(dataDir, "animations")
        );

        itemRecipeManager = ItemRecipeManager.GetSingleton();
        await itemRecipeManager.loadItemRecipes(path.join(dataDir, "items"));
        furnitureRecipeManager = FurnitureRecipeManager.GetSingleton();
        await furnitureRecipeManager.loadFurnitureRecipes(path.join(dataDir, "furniture"));
        vfxRecipeManager = VfxRecipeManager.GetSingleton();
        await vfxRecipeManager.loadVfxRecipes(path.join(dataDir, "vfx"));

        scenarioRecipeManager = new ScenarioRecipeManager();
        await scenarioRecipeManager.loadScenarioRecipes(path.join(dataDir, "scenarios"));
    }, 60000);

    afterEach(() => {
        game?.destroyGame();
        game = null;
    });

    /**
     * Connecting two clients auto-starts the test scenario (see `LobbyPhaseHandler`),
     * which puts the goodies side into the manual armament phase.
     */
    async function startArmamentPhase() {
        game = new Game(
            armingClientId,
            scenarioRecipeManager,
            itemRecipeManager,
            furnitureRecipeManager,
            vfxRecipeManager,
            materialManager
        );

        const armingSocket = new FakeSocket();
        const waitingSocket = new FakeSocket();

        game.addClient(armingClientId, "A")?.assignSocket(armingSocket as unknown as WebSocket);
        game.addClient(waitingClientId, "B")?.assignSocket(waitingSocket as unknown as WebSocket);

        await settle();

        return { game, armingSocket, waitingSocket };
    }

    function send(game: Game, clientId: string, message: ClientToServerMessage) {
        game.receiveMessage(
            JSON.stringify(message) as unknown as MessageEvent,
            game.getClient(clientId)
        );
    }

    it("sends the arming side a store and every unit's inventory when the phase starts", async () => {
        const { armingSocket, waitingSocket } = await startArmamentPhase();

        expect(armingSocket.lastReceived("server:phase").payload.phase).toBe(Phase.enum.armament);

        const { units, store, inventories } =
            armingSocket.lastReceived("server:armament:state").payload;

        expect(units.length).toBeGreaterThan(0);
        expect(store.items.length).toBeGreaterThan(0);
        expect(inventories.map(({ unitId }) => unitId)).toEqual(units.map(({ id }) => id));
        expect(units[0]).toMatchObject({ inventoryWeight: expect.any(Number) });

        expect(waitingSocket.received("server:armament:state")).toHaveLength(0);
        expect(waitingSocket.lastReceived("server:wait").payload?.phase).toBe(Phase.enum.armament);
    });

    it("buys an item into the selected unit's inventory and charges the budget", async () => {
        const { game, armingSocket } = await startArmamentPhase();
        const state = armingSocket.lastReceived("server:armament:state").payload;
        const unitId = state.units[0].id;
        const affordable = state.store.items.find(
            (entry: StoreItemView) => entry.cost > 0 && entry.cost <= state.store.budget
        );
        expect(affordable).toBeDefined();

        send(game, armingClientId, {
            type: "client:armament:buy",
            payload: { unitId, itemId: affordable!.itemId }
        });
        await settle();

        const update = armingSocket.lastReceived("server:armament:update").payload;
        expect(update.unitId).toBe(unitId);
        expect(update.store.budget).toBeLessThan(state.store.budget);
        expect(update.inventory.items.length).toBe(state.inventories[0].items.length + 1);
    });

    it("refuses purchases that break the budget threshold", async () => {
        const { game, armingSocket } = await startArmamentPhase();
        const state = armingSocket.lastReceived("server:armament:state").payload;
        const unitId = state.units[0].id;

        const armingSide = game.sides.find((side) => side.findStore() != null);
        expect(armingSide?.findStore()).toBeDefined();

        // Force the budget near the floor so the next purchase must be refused,
        // independent of scenario budget / catalog stock.
        const store = armingSide!.store;
        const target = [...state.store.items]
            .filter((entry: StoreItemView) => entry.cost > 0 && entry.item.quantity > 0)
            .sort((left: StoreItemView, right: StoreItemView) => right.cost - left.cost)[0];
        expect(target).toBeDefined();

        (store as unknown as { _budget: number })._budget = store.threshold + target!.cost - 1;

        send(game, armingClientId, {
            type: "client:armament:buy",
            payload: { unitId, itemId: target!.itemId }
        });
        await settle();

        expect(armingSocket.received("server:error").length).toBeGreaterThan(0);
        expect(armingSocket.lastReceived("server:error").payload).toBe("INSUFFICIENT_BUDGET");
        expect(store.budget).toBeGreaterThanOrEqual(store.threshold);
    });

    it("leaves the armament phase once the arming side is done", async () => {
        const { game, armingSocket, waitingSocket } = await startArmamentPhase();

        send(game, armingClientId, { type: "client:armament:end", payload: null });
        await settle();

        expect(game.phase).not.toBe(Phase.enum.armament);
        expect(armingSocket.lastReceived("server:phase").payload.phase).not.toBe(
            Phase.enum.armament
        );
        expect(waitingSocket.lastReceived("server:phase").payload.phase).not.toBe(
            Phase.enum.armament
        );
    });
});
