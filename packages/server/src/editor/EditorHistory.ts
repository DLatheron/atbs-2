import { ITilePos, Orientation, TilePos, randomOrientation } from "@atbs/maths";
import { FurnitureState, ItemId, TileUpdate, type EditorMarkersState } from "@atbs/shared-data";
import type { WorldMap } from "../game/WorldMap.js";
import { TerrainManager } from "../game/TerrainManager.js";
import { ImageManager, isCompoundId } from "../game/ImageManager.js";
import { TerrainFactory } from "../game/TerrainFactory.js";
import { FurnitureManager } from "../game/FurnitureManager.js";
import { ItemManager } from "../game/ItemManager.js";
import { FurnitureId } from "@atbs/shared-data";
import type { EditorMarkers } from "./EditorMarkers.js";

export interface TerrainTileState {
    terrainId: string;
    orientation: Orientation;
}

export interface TerrainEditCommand {
    tilePos: ITilePos;
    before: TerrainTileState;
    after: TerrainTileState;
}

export interface FurnitureTileState {
    furnitureId?: FurnitureId;
    orientation?: Orientation;
    state?: FurnitureState;
}

export interface FurnitureEditCommand {
    tiles: {
        tilePos: ITilePos;
        before: FurnitureTileState;
        after: FurnitureTileState;
    }[];
}

export interface ItemPlacementState {
    id: ItemId;
    quantity?: number;
}

export interface ItemTileState {
    items: ItemPlacementState[];
}

export interface ItemEditCommand {
    tilePos: ITilePos;
    before: ItemTileState;
    after: ItemTileState;
}

export interface MarkersEditCommand {
    before: EditorMarkersState;
    after: EditorMarkersState;
}

type EditCommand =
    | { type: "terrain"; command: TerrainEditCommand }
    | { type: "furniture"; command: FurnitureEditCommand }
    | { type: "item"; command: ItemEditCommand }
    | { type: "markers"; command: MarkersEditCommand };

export interface EditorUndoResult {
    tileUpdates: TileUpdate[];
    markersChanged: boolean;
}

export class EditorHistory {
    private readonly _undoStack: EditCommand[] = [];
    private readonly _redoStack: EditCommand[] = [];
    private _hasUnsavedChanges = false;

    get canUndo(): boolean {
        return this._undoStack.length > 0;
    }

    get canRedo(): boolean {
        return this._redoStack.length > 0;
    }

    get hasUnsavedChanges(): boolean {
        return this._hasUnsavedChanges;
    }

    clear() {
        this._undoStack.length = 0;
        this._redoStack.length = 0;
        this._hasUnsavedChanges = false;
    }

    markSaved() {
        this._hasUnsavedChanges = false;
    }

    private _markDirty() {
        this._hasUnsavedChanges = true;
    }

    recordTerrainEdit(command: TerrainEditCommand) {
        if (
            command.before.terrainId === command.after.terrainId &&
            command.before.orientation === command.after.orientation
        ) {
            return;
        }

        this._undoStack.push({ type: "terrain", command });
        this._redoStack.length = 0;
        this._markDirty();
    }

    recordFurnitureEdit(command: FurnitureEditCommand) {
        if (command.tiles.length === 0) {
            return;
        }

        const hasChanges = command.tiles.some(
            (tile) =>
                tile.before.furnitureId !== tile.after.furnitureId ||
                tile.before.orientation !== tile.after.orientation ||
                tile.before.state !== tile.after.state
        );

        if (!hasChanges) {
            return;
        }

        this._undoStack.push({ type: "furniture", command });
        this._redoStack.length = 0;
        this._markDirty();
    }

    recordItemEdit(command: ItemEditCommand) {
        const beforeIds = command.before.items.map((item) => item.id).join(",");
        const afterIds = command.after.items.map((item) => item.id).join(",");
        const beforeQty = command.before.items.map((item) => item.quantity ?? "").join(",");
        const afterQty = command.after.items.map((item) => item.quantity ?? "").join(",");

        if (beforeIds === afterIds && beforeQty === afterQty) {
            return;
        }

        this._undoStack.push({ type: "item", command });
        this._redoStack.length = 0;
        this._markDirty();
    }

    recordMarkersEdit(command: MarkersEditCommand) {
        if (JSON.stringify(command.before) === JSON.stringify(command.after)) {
            return;
        }

        this._undoStack.push({ type: "markers", command });
        this._redoStack.length = 0;
        this._markDirty();
    }

    async undo(
        map: WorldMap,
        furnitureManager: FurnitureManager,
        itemManager: ItemManager,
        markers: EditorMarkers
    ): Promise<EditorUndoResult> {
        const edit = this._undoStack.pop();
        if (!edit) {
            return { tileUpdates: [], markersChanged: false };
        }

        const result = await this._applyEdit(map, furnitureManager, itemManager, markers, edit, "before");
        this._redoStack.push(edit);

        return result;
    }

    async redo(
        map: WorldMap,
        furnitureManager: FurnitureManager,
        itemManager: ItemManager,
        markers: EditorMarkers
    ): Promise<EditorUndoResult> {
        const edit = this._redoStack.pop();
        if (!edit) {
            return { tileUpdates: [], markersChanged: false };
        }

        const result = await this._applyEdit(map, furnitureManager, itemManager, markers, edit, "after");
        this._undoStack.push(edit);

        return result;
    }

    private async _applyEdit(
        map: WorldMap,
        furnitureManager: FurnitureManager,
        itemManager: ItemManager,
        markers: EditorMarkers,
        edit: EditCommand,
        direction: "before" | "after"
    ): Promise<EditorUndoResult> {
        if (edit.type === "markers") {
            markers.restoreState(edit.command[direction]);
            return { tileUpdates: [], markersChanged: true };
        }

        if (edit.type === "terrain") {
            const state = edit.command[direction];
            await this._applyTerrainState(map, edit.command.tilePos, state);
            return {
                tileUpdates: [map.getTile(new TilePos(edit.command.tilePos)).generateTileUpdate()],
                markersChanged: false
            };
        }

        if (edit.type === "item") {
            const state = edit.command[direction];
            await this._applyItemState(map, itemManager, edit.command.tilePos, state);
            return {
                tileUpdates: [map.getTile(new TilePos(edit.command.tilePos)).generateTileUpdate()],
                markersChanged: false
            };
        }

        const updates: TileUpdate[] = [];
        for (const tileEdit of edit.command.tiles) {
            const state = tileEdit[direction];
            await this._applyFurnitureState(map, furnitureManager, tileEdit.tilePos, state);
            updates.push(map.getTile(new TilePos(tileEdit.tilePos)).generateTileUpdate());
        }
        return { tileUpdates: updates, markersChanged: false };
    }

    private async _applyFurnitureState(
        map: WorldMap,
        furnitureManager: FurnitureManager,
        tilePos: ITilePos,
        state: FurnitureTileState
    ) {
        const tile = map.getTile(new TilePos(tilePos));

        if (!state.furnitureId) {
            tile.clearFurniture();
            return;
        }

        tile.setFurniture(
            furnitureManager.newFurniture(state.furnitureId, {
                location: new TilePos(tilePos),
                orientation: state.orientation,
                state: state.state
            })
        );
    }

    private async _applyItemState(
        map: WorldMap,
        itemManager: ItemManager,
        tilePos: ITilePos,
        state: ItemTileState
    ) {
        const tile = map.getTile(new TilePos(tilePos));

        for (const item of [...tile.items]) {
            tile.removeItem(item);
            itemManager.deleteItem(item.id);
        }

        for (const itemState of state.items) {
            const item = itemManager.newItem(itemState.id, {
                location: new TilePos(tilePos),
                quantity: itemState.quantity
            });
            tile.addItem(item);
        }
    }

    static resolveOrientation(
        orientation: Orientation,
        randomiseOrientation: boolean,
        allowRandomOrientation: boolean
    ): Orientation {
        if (randomiseOrientation && allowRandomOrientation) {
            return randomOrientation();
        }
        return orientation;
    }

    static async ensureTerrainExists(terrainId: string): Promise<void> {
        const terrainManager = TerrainManager.GetSingleton();
        if (terrainManager.has(terrainId)) {
            return;
        }

        if (isCompoundId(terrainId)) {
            TerrainFactory.createCompoundTerrain(terrainId);
            const imageManager = ImageManager.GetSingleton();
            if (!imageManager.exists(terrainId)) {
                await imageManager.generateBlendedImage(terrainId);
            }
            return;
        }

        throw new Error(`Unknown terrain id: ${terrainId}`);
    }

    private async _applyTerrainState(map: WorldMap, tilePos: ITilePos, state: TerrainTileState) {
        await EditorHistory.ensureTerrainExists(state.terrainId);
        const tile = map.getTile(new TilePos(tilePos));
        tile.setTerrain(state.terrainId, state.orientation);
    }
}
