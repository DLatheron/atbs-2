import { ITilePos, Orientation, TilePos, randomOrientation } from "@atbs/maths";
import { TileUpdate } from "@atbs/shared-data";
import type { WorldMap } from "../game/WorldMap.js";
import { TerrainManager } from "../game/TerrainManager.js";
import { ImageManager, isCompoundId } from "../game/ImageManager.js";
import { TerrainFactory } from "../game/TerrainFactory.js";

export interface TerrainTileState {
    terrainId: string;
    orientation: Orientation;
}

export interface TerrainEditCommand {
    tilePos: ITilePos;
    before: TerrainTileState;
    after: TerrainTileState;
}

export class EditorHistory {
    private readonly _undoStack: TerrainEditCommand[] = [];
    private readonly _redoStack: TerrainEditCommand[] = [];

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

        this._undoStack.push(command);
        this._redoStack.length = 0;
    }

    async undo(map: WorldMap): Promise<TileUpdate | undefined> {
        const command = this._undoStack.pop();
        if (!command) {
            return undefined;
        }

        await this._applyTerrainState(map, command.tilePos, command.before);
        this._redoStack.push(command);

        return map.getTile(new TilePos(command.tilePos)).generateTileUpdate();
    }

    async redo(map: WorldMap): Promise<TileUpdate | undefined> {
        const command = this._redoStack.pop();
        if (!command) {
            return undefined;
        }

        await this._applyTerrainState(map, command.tilePos, command.after);
        this._undoStack.push(command);

        return map.getTile(new TilePos(command.tilePos)).generateTileUpdate();
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

    private async _applyTerrainState(
        map: WorldMap,
        tilePos: ITilePos,
        state: TerrainTileState
    ) {
        await EditorHistory.ensureTerrainExists(state.terrainId);
        const tile = map.getTile(new TilePos(tilePos));
        tile.setTerrain(state.terrainId, state.orientation);
    }
}
