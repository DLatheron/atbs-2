import { ITilePos, Orientation, TilePos, randomOrientation } from "@atbs/maths";
import { FurnitureState, TileUpdate } from "@atbs/shared-data";
import type { WorldMap } from "../game/WorldMap.js";
import { TerrainManager } from "../game/TerrainManager.js";
import { ImageManager, isCompoundId } from "../game/ImageManager.js";
import { TerrainFactory } from "../game/TerrainFactory.js";
import { FurnitureManager } from "../game/FurnitureManager.js";
import { FurnitureId } from "@atbs/shared-data";

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

type EditCommand =
    | { type: "terrain"; command: TerrainEditCommand }
    | { type: "furniture"; command: FurnitureEditCommand };

export class EditorHistory {
    private readonly _undoStack: EditCommand[] = [];
    private readonly _redoStack: EditCommand[] = [];

    get canUndo(): boolean {
        return this._undoStack.length > 0;
    }

    get canRedo(): boolean {
        return this._redoStack.length > 0;
    }

    clear() {
        this._undoStack.length = 0;
        this._redoStack.length = 0;
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
    }

    async undo(map: WorldMap, furnitureManager: FurnitureManager): Promise<TileUpdate[]> {
        const edit = this._undoStack.pop();
        if (!edit) {
            return [];
        }

        const updates = await this._applyEdit(map, furnitureManager, edit, "before");
        this._redoStack.push(edit);

        return updates;
    }

    async redo(map: WorldMap, furnitureManager: FurnitureManager): Promise<TileUpdate[]> {
        const edit = this._redoStack.pop();
        if (!edit) {
            return [];
        }

        const updates = await this._applyEdit(map, furnitureManager, edit, "after");
        this._undoStack.push(edit);

        return updates;
    }

    private async _applyEdit(
        map: WorldMap,
        furnitureManager: FurnitureManager,
        edit: EditCommand,
        direction: "before" | "after"
    ): Promise<TileUpdate[]> {
        if (edit.type === "terrain") {
            const state = edit.command[direction];
            await this._applyTerrainState(map, edit.command.tilePos, state);
            return [map.getTile(new TilePos(edit.command.tilePos)).generateTileUpdate()];
        }

        const updates: TileUpdate[] = [];
        for (const tileEdit of edit.command.tiles) {
            const state = tileEdit[direction];
            await this._applyFurnitureState(map, furnitureManager, tileEdit.tilePos, state);
            updates.push(map.getTile(new TilePos(tileEdit.tilePos)).generateTileUpdate());
        }
        return updates;
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
