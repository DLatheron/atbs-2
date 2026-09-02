import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";
import {
    ClientId,
    ClientToServerMessage,
    EditorId,
    ServerToClientMessage,
    TileUpdate
} from "@atbs/shared-data";
import { CastToArray, Logger, MessageManager } from "@atbs/misc";
import { Orientation, TilePos } from "@atbs/maths";

import { EditorClient } from "./EditorClient.js";
import { EditorClientManager } from "./EditorClientManager.js";
import { editorManager } from "./EditorManager.js";
import { createDefaultMapRecipe } from "./createDefaultMapRecipe.js";
import { EditorHistory, type FurnitureTileState } from "./EditorHistory.js";
import { TerrainPaletteManager } from "./TerrainPaletteManager.js";
import { FurniturePaletteManager } from "./FurniturePaletteManager.js";
import { WallPaletteManager } from "./WallPaletteManager.js";
import { ItemPaletteManager } from "./ItemPaletteManager.js";
import {
    getBrushDimensions,
    iterateFurnitureTiles,
    resolveFurnitureTileOrientation,
    rotateSample
} from "./furnitureHelpers.js";
import { WorldMap, type MapHost } from "../game/WorldMap.js";
import { ItemManager } from "../game/ItemManager.js";
import { ItemRecipeManager } from "../game/ItemRecipeManager.js";
import { FurnitureManager } from "../game/FurnitureManager.js";
import { FurnitureRecipeManager } from "../game/FurnitureRecipeManager.js";
import { MaterialManager } from "../game/MaterialManager.js";
import { VisibilityManager } from "../game/VisibilityManager.js";
import { config } from "../config/config.schema.js";

const DEFAULT_TERRAIN_ID = "grass.terrain";

const EDITOR_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const EDITOR_SAVES_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../data/editor-saves"
);

function randomSegment(length: number): string {
    let segment = "";
    for (let i = 0; i < length; i++) {
        segment += EDITOR_ID_CHARS[randomInt(EDITOR_ID_CHARS.length)];
    }
    return segment;
}

function generateEditorId(): string {
    return `${randomSegment(4)}-${randomSegment(4)}`;
}

interface EditorMessageContext {
    editor: Editor;
}

export type EditorMessageManager = MessageManager<
    EditorMessageContext,
    ClientToServerMessage,
    EditorClient
>;

export class Editor implements MapHost {
    readonly logger: Logger;

    private _ownerId: ClientId;
    private readonly _id: EditorId;
    private readonly _clientManager: EditorClientManager;
    private readonly _context: EditorMessageContext;
    private readonly _messageManager: EditorMessageManager;
    private readonly _itemManager: ItemManager;
    private readonly _furnitureManager: FurnitureManager;
    private readonly _visibilityManager: VisibilityManager;
    private readonly _map: WorldMap;
    private readonly _history: EditorHistory;
    private readonly _terrainPalette;
    private readonly _furniturePalette;
    private readonly _wallPalette;
    private readonly _itemPalette;
    private _isDestroying = false;

    constructor(
        ownerId: ClientId,
        itemRecipeManager: ItemRecipeManager,
        furnitureRecipeManager: FurnitureRecipeManager,
        materialManager: MaterialManager
    ) {
        const editorId = generateEditorId() as EditorId;

        this.logger = new Logger(`Editor-${editorId}`, config.logLevels?.editor);

        this._id = editorId;
        this._ownerId = ownerId;
        this._clientManager = new EditorClientManager();
        this._itemManager = new ItemManager(itemRecipeManager);
        this._furnitureManager = new FurnitureManager(furnitureRecipeManager, materialManager);
        this._visibilityManager = new VisibilityManager(this);

        this._context = { editor: this };
        this._messageManager = new MessageManager<
            EditorMessageContext,
            ClientToServerMessage,
            EditorClient
        >(this._context);

        this._map = new WorldMap(createDefaultMapRecipe(editorId), this);
        this._history = new EditorHistory();
        this._terrainPalette = TerrainPaletteManager.GetSingleton().getDefault();
        this._furniturePalette = FurniturePaletteManager.GetSingleton().getDefault();
        this._wallPalette = WallPaletteManager.GetSingleton().getDefault();
        this._itemPalette = ItemPaletteManager.GetSingleton().getDefault();

        this._registerMessageHandlers();
    }

    get id(): EditorId {
        return this._id;
    }

    get editorId(): EditorId {
        return this._id;
    }

    get ownerId(): ClientId {
        return this._ownerId;
    }

    get clients(): EditorClient[] {
        return this._clientManager.clients;
    }

    get numClients(): number {
        return this.clients.length;
    }

    get itemManager(): ItemManager {
        return this._itemManager;
    }

    get furnitureManager(): FurnitureManager {
        return this._furnitureManager;
    }

    get visibilityManager(): VisibilityManager {
        return this._visibilityManager;
    }

    get map(): WorldMap {
        return this._map;
    }

    reportError(error: string) {
        this.logger.error(error);
    }

    addClient(clientId: ClientId, name: string): EditorClient | null {
        const existingClient = this._clientManager.findClient(clientId);
        if (existingClient) {
            this.reportError(`Client ${clientId} is already in editor ${this.editorId}`);
            return existingClient;
        }

        const client = new EditorClient({ id: clientId, name }, this);
        this._clientManager.addClient(client);

        return client;
    }

    removeClient(clientId: ClientId): boolean {
        const removed = this._clientManager.removeClient(clientId);

        if (removed && this.numClients === 0 && !this._isDestroying) {
            this.destroyEditor();
            editorManager.removeEditor(this.editorId);
        }

        return removed;
    }

    getClient(clientId: ClientId) {
        return this._clientManager.getClient(clientId);
    }

    findClient(clientId: ClientId): EditorClient | undefined {
        return this._clientManager.findClient(clientId);
    }

    clientConnected(client: EditorClient): void {
        client.sendMessage({
            type: "server:editor:map",
            payload: this._map.renderEditorMap()
        });
        client.sendMessage({
            type: "server:editor:terrain:palette",
            payload: this._terrainPalette.toWireFormat()
        });
        client.sendMessage({
            type: "server:editor:furniture:palette",
            payload: this._furniturePalette.toWireFormat(FurnitureRecipeManager.GetSingleton())
        });
        client.sendMessage({
            type: "server:editor:wall:palette",
            payload: this._wallPalette.toWireFormat(FurnitureRecipeManager.GetSingleton())
        });
        client.sendMessage({
            type: "server:editor:item:palette",
            payload: this._itemPalette.toWireFormat(ItemRecipeManager.GetSingleton())
        });
        client.sendMessage({
            type: "server:editor:history",
            payload: this._historyState()
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    clientDisconnected(_client: EditorClient): void {
        // No-op for now; session teardown happens when the last client is removed.
    }

    sendMessage(message: ServerToClientMessage, to: ClientId | ClientId[]) {
        const clients = CastToArray(to).map((clientId) => this.getClient(clientId));
        clients.forEach((client) => client.sendMessage(message));
    }

    broadcastMessage(message: ServerToClientMessage, exclude?: ClientId | ClientId[]) {
        const excludes = exclude ? CastToArray(exclude) : [];

        for (const client of this._clientManager.clients) {
            if (!excludes.includes(client.id)) {
                client.sendMessage(message);
            }
        }
    }

    queueMessage(message: ClientToServerMessage, from: EditorClient) {
        this._messageManager.enqueueMessage(message, from);
    }

    receiveMessage(data: MessageEvent, from: EditorClient) {
        const messageString = data.toString();

        try {
            const message = ClientToServerMessage.parse(JSON.parse(messageString));
            this.queueMessage(message, from);
        } catch (error) {
            this.logger.error("Issue decoding message", messageString);
            throw error;
        }
    }

    async saveMap(): Promise<{ filename: string; mapId: string }> {
        const mapRecipe = this._map.toMapRecipe();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `${mapRecipe.id}-${timestamp}.map.json`;
        const fullPath = path.join(EDITOR_SAVES_DIR, filename);

        await mkdir(EDITOR_SAVES_DIR, { recursive: true });
        await writeFile(fullPath, `${JSON.stringify(mapRecipe, null, 4)}\n`, "utf-8");

        this.logger.info(`Saved map recipe to ${fullPath}`);

        return { filename, mapId: mapRecipe.id };
    }

    destroyEditor() {
        if (this._isDestroying) {
            return;
        }

        this._isDestroying = true;
        this.logger.info("Destroying editor", this.editorId);

        while (this.clients.length > 0) {
            const client = this.clients[0];
            client.forceDisconnect();
            this._clientManager.removeClient(client.id);
        }
    }

    private _registerMessageHandlers() {
        this._messageManager.registerHandler(
            "client:editor:save",
            async (_context, _payload, from) => {
                try {
                    const result = await this.saveMap();
                    from.sendMessage({
                        type: "server:editor:saved",
                        payload: result
                    });
                } catch (error) {
                    this.logger.error("Failed to save editor map", error);
                }
            }
        );

        this._messageManager.registerHandler(
            "client:editor:terrain:paint",
            async (_context, payload) => {
                await this._paintTerrain(payload);
            }
        );

        this._messageManager.registerHandler(
            "client:editor:terrain:reset",
            async (_context, payload) => {
                await this._resetTerrain(payload.tilePos);
            }
        );

        this._messageManager.registerHandler(
            "client:editor:furniture:paint",
            async (_context, payload) => {
                await this._paintFurniture(payload);
            }
        );

        this._messageManager.registerHandler(
            "client:editor:furniture:reset",
            async (_context, payload) => {
                await this._resetFurniture(payload);
            }
        );

        this._messageManager.registerHandler(
            "client:editor:wall:paint",
            async (_context, payload) => {
                await this._paintWall(payload);
            }
        );

        this._messageManager.registerHandler(
            "client:editor:wall:reset",
            async (_context, payload) => {
                await this._resetWall(payload.tilePos);
            }
        );

        this._messageManager.registerHandler(
            "client:editor:item:paint",
            async (_context, payload) => {
                await this._paintItem(payload);
            }
        );

        this._messageManager.registerHandler(
            "client:editor:item:reset",
            async (_context, payload) => {
                await this._resetItem(payload.tilePos);
            }
        );

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this._messageManager.registerHandler("client:editor:undo", async (_context, _payload) => {
            await this._undo();
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this._messageManager.registerHandler("client:editor:redo", async (_context, _payload) => {
            await this._redo();
        });
    }

    private _historyState() {
        return {
            canUndo: this._history.canUndo,
            canRedo: this._history.canRedo
        };
    }

    private _broadcastHistory() {
        this.broadcastMessage({
            type: "server:editor:history",
            payload: this._historyState()
        });
    }

    private _broadcastTileUpdates(updates: TileUpdate[]) {
        if (updates.length === 0) {
            return;
        }

        this.broadcastMessage({
            type: "server:editor:map:update",
            payload: updates
        });
    }

    private async _paintTerrain(payload: {
        tilePos: { row: number; col: number };
        terrainId: string;
        orientation: Orientation;
        randomiseOrientation: boolean;
    }) {
        const tilePos = new TilePos(payload.tilePos);
        const tile = this._map.getTile(tilePos);
        const before = tile.getTerrainState();

        await EditorHistory.ensureTerrainExists(payload.terrainId);

        const paletteTerrain = this._terrainPalette.getTerrainById(payload.terrainId);
        const allowRandomOrientation = paletteTerrain
            ? this._terrainPalette.allowsRandomOrientation(payload.terrainId)
            : false;

        const orientation = EditorHistory.resolveOrientation(
            payload.orientation,
            payload.randomiseOrientation,
            allowRandomOrientation
        );

        tile.setTerrain(payload.terrainId, orientation);
        const after = tile.getTerrainState();

        this._history.recordTerrainEdit({ tilePos: payload.tilePos, before, after });
        this._broadcastTileUpdates([tile.generateTileUpdate()]);
        this._broadcastHistory();
    }

    private async _paintFurniture(payload: {
        tilePos: { row: number; col: number };
        furnitureId: string;
        brushSize: { x: number; y: number };
        brushOrientation: Orientation;
        orientation: Orientation;
        randomiseOrientation: boolean;
    }) {
        const tilePos = new TilePos(payload.tilePos);
        const selectedFurniture = this._furniturePalette.getFurnitureById(payload.furnitureId);
        if (!selectedFurniture) {
            throw new Error(`Furniture with id ${payload.furnitureId} not found`);
        }

        const width = selectedFurniture.tiles[0].length;
        const height = selectedFurniture.tiles.length;

        if (width !== payload.brushSize.x || height !== payload.brushSize.y) {
            throw new Error(
                `Furniture with id ${payload.furnitureId} does not match the brush size`
            );
        }

        const actualOrientation = EditorHistory.resolveOrientation(
            payload.orientation,
            payload.randomiseOrientation,
            selectedFurniture.allowRandomOrientation
        );

        const isMultiTile = width > 1 || height > 1;
        const dimensions = getBrushDimensions(payload.brushSize, actualOrientation);
        const tileEdits: {
            tilePos: { row: number; col: number };
            before: FurnitureTileState;
            after: FurnitureTileState;
        }[] = [];

        iterateFurnitureTiles(dimensions, (tileXY) => {
            const samplePos = rotateSample(tileXY, dimensions, actualOrientation);
            const tileDefinition = selectedFurniture.tiles[samplePos.y][samplePos.x];
            const affectedTilePos = tilePos.add(tileXY);
            const tile = this._map.getTile(affectedTilePos);
            const before = tile.getFurnitureState();

            const tileOrientation = resolveFurnitureTileOrientation(
                tileDefinition.orientation,
                actualOrientation,
                isMultiTile
            );

            tile.setFurniture(
                this._furnitureManager.newFurniture(tileDefinition.furnitureId, {
                    location: affectedTilePos,
                    orientation: tileOrientation
                })
            );

            tileEdits.push({
                tilePos: affectedTilePos,
                before,
                after: tile.getFurnitureState()
            });
        });

        this._history.recordFurnitureEdit({ tiles: tileEdits });
        this._broadcastTileUpdates(
            tileEdits.map(({ tilePos: pos }) =>
                this._map.getTile(new TilePos(pos)).generateTileUpdate()
            )
        );
        this._broadcastHistory();
    }

    private async _resetFurniture(payload: {
        tilePos: { row: number; col: number };
        brushSize: { x: number; y: number };
        brushOrientation: Orientation;
    }) {
        const tilePos = new TilePos(payload.tilePos);
        const dimensions = getBrushDimensions(payload.brushSize, payload.brushOrientation);
        const tileEdits: {
            tilePos: { row: number; col: number };
            before: FurnitureTileState;
            after: FurnitureTileState;
        }[] = [];

        iterateFurnitureTiles(dimensions, (tileXY) => {
            const affectedTilePos = tilePos.add(tileXY);
            const tile = this._map.getTile(affectedTilePos);
            const before = tile.getFurnitureState();

            tile.clearFurniture();

            tileEdits.push({
                tilePos: affectedTilePos,
                before,
                after: tile.getFurnitureState()
            });
        });

        this._history.recordFurnitureEdit({ tiles: tileEdits });
        this._broadcastTileUpdates(
            tileEdits.map(({ tilePos: pos }) =>
                this._map.getTile(new TilePos(pos)).generateTileUpdate()
            )
        );
        this._broadcastHistory();
    }

    private async _paintWall(payload: {
        tilePos: { row: number; col: number };
        wallId: string;
        orientation: Orientation;
        autoFit: boolean;
        direction?: Orientation;
    }) {
        const tilePos = new TilePos(payload.tilePos);
        const affectedPositions = this._getWallRematchPositions(tilePos, payload.autoFit);
        const beforeStates = new Map(
            affectedPositions.map((pos) => [
                pos.toString(),
                this._map.getTile(pos).getFurnitureState()
            ])
        );

        const fallback = { id: payload.wallId, orientation: payload.orientation };
        const matched = payload.autoFit
            ? this._wallPalette.matchWall(this._map, tilePos, fallback, payload.direction)
            : fallback;

        this._setWallAt(tilePos, matched.id, matched.orientation);

        if (payload.autoFit) {
            this._rematchAdjacentWalls(tilePos);
            this._rematchWallAt(tilePos, payload.direction);
        }

        this._recordAndBroadcastWallEdits(affectedPositions, beforeStates);
    }

    private async _resetWall(tilePos: { row: number; col: number }) {
        const pos = new TilePos(tilePos);
        const affectedPositions = this._getWallRematchPositions(pos, true);
        const beforeStates = new Map(
            affectedPositions.map((position) => [
                position.toString(),
                this._map.getTile(position).getFurnitureState()
            ])
        );

        this._map.getTile(pos).clearFurniture();
        this._rematchAdjacentWalls(pos);

        this._recordAndBroadcastWallEdits(affectedPositions, beforeStates);
    }

    private _getWallRematchPositions(tilePos: TilePos, includeNeighbors: boolean): TilePos[] {
        if (!includeNeighbors) {
            return [tilePos];
        }

        return [
            tilePos,
            tilePos.stepInDirection(Orientation.NORTH),
            tilePos.stepInDirection(Orientation.EAST),
            tilePos.stepInDirection(Orientation.SOUTH),
            tilePos.stepInDirection(Orientation.WEST)
        ];
    }

    private _setWallAt(tilePos: TilePos, wallId: string, orientation: Orientation) {
        this._map.getTile(tilePos).setFurniture(
            this._furnitureManager.newFurniture(wallId, {
                location: tilePos,
                orientation
            })
        );
    }

    private _rematchWallAt(tilePos: TilePos, preferredDirection?: Orientation) {
        const tile = this._map.getTile(tilePos);
        const state = tile.getFurnitureState();

        if (!state.furnitureId || !this._wallPalette.isWallFurniture(state.furnitureId)) {
            return;
        }

        const matched = this._wallPalette.matchWall(
            this._map,
            tilePos,
            {
                id: state.furnitureId,
                orientation: state.orientation ?? Orientation.NORTH
            },
            preferredDirection
        );

        this._setWallAt(tilePos, matched.id, matched.orientation);
    }

    private _rematchAdjacentWalls(tilePos: TilePos) {
        for (const direction of [
            Orientation.NORTH,
            Orientation.EAST,
            Orientation.SOUTH,
            Orientation.WEST
        ]) {
            this._rematchWallAt(tilePos.stepInDirection(direction));
        }
    }

    private _recordAndBroadcastWallEdits(
        affectedPositions: TilePos[],
        beforeStates: Map<string, FurnitureTileState>
    ) {
        const tileEdits: {
            tilePos: { row: number; col: number };
            before: FurnitureTileState;
            after: FurnitureTileState;
        }[] = [];

        for (const position of affectedPositions) {
            const before = beforeStates.get(position.toString());
            if (!before) {
                continue;
            }

            const after = this._map.getTile(position).getFurnitureState();
            if (
                before.furnitureId !== after.furnitureId ||
                before.orientation !== after.orientation ||
                before.state !== after.state
            ) {
                tileEdits.push({
                    tilePos: position,
                    before,
                    after
                });
            }
        }

        if (tileEdits.length === 0) {
            return;
        }

        this._history.recordFurnitureEdit({ tiles: tileEdits });
        this._broadcastTileUpdates(
            tileEdits.map(({ tilePos: pos }) =>
                this._map.getTile(new TilePos(pos)).generateTileUpdate()
            )
        );
        this._broadcastHistory();
    }

    private async _resetTerrain(tilePos: { row: number; col: number }) {
        const pos = new TilePos(tilePos);
        const tile = this._map.getTile(pos);
        const before = tile.getTerrainState();
        const after = { terrainId: DEFAULT_TERRAIN_ID, orientation: before.orientation };

        tile.setTerrain(DEFAULT_TERRAIN_ID, after.orientation);

        this._history.recordTerrainEdit({ tilePos, before, after });
        this._broadcastTileUpdates([tile.generateTileUpdate()]);
        this._broadcastHistory();
    }

    private async _paintItem(payload: { tilePos: { row: number; col: number }; itemId: string }) {
        const tilePos = new TilePos(payload.tilePos);
        const tile = this._map.getTile(tilePos);
        const before = tile.getItemState();

        const item = this._itemManager.newItem(payload.itemId, { location: tilePos });
        tile.addItem(item);

        const after = tile.getItemState();

        this._history.recordItemEdit({ tilePos: payload.tilePos, before, after });
        this._broadcastTileUpdates([tile.generateTileUpdate()]);
        this._broadcastHistory();
    }

    private async _resetItem(tilePos: { row: number; col: number }) {
        const pos = new TilePos(tilePos);
        const tile = this._map.getTile(pos);
        const before = tile.getItemState();

        this._clearTileItems(tile);

        const after = tile.getItemState();

        this._history.recordItemEdit({ tilePos, before, after });
        this._broadcastTileUpdates([tile.generateTileUpdate()]);
        this._broadcastHistory();
    }

    private _clearTileItems(tile: ReturnType<WorldMap["getTile"]>) {
        for (const item of [...tile.items]) {
            tile.removeItem(item);
            this._itemManager.deleteItem(item.id);
        }
    }

    private async _undo() {
        const updates = await this._history.undo(
            this._map,
            this._furnitureManager,
            this._itemManager
        );
        if (updates.length > 0) {
            this._broadcastTileUpdates(updates);
            this._broadcastHistory();
        }
    }

    private async _redo() {
        const updates = await this._history.redo(
            this._map,
            this._furnitureManager,
            this._itemManager
        );
        if (updates.length > 0) {
            this._broadcastTileUpdates(updates);
            this._broadcastHistory();
        }
    }
}
