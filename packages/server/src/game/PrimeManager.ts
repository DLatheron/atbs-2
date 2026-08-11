import { InstanceId } from "@atbs/shared-data";
import type { Item } from "./Item.js";
import type { Game } from "./Game.js";
import type { WorldMap } from "./WorldMap.js";

export class PrimeManager {
    private readonly _game: Game;
    private readonly _primedItems: Map<InstanceId, Item>;

    constructor(game: Game) {
        this._game = game;
        this._primedItems = new Map<InstanceId, Item>();
    }

    get game(): Game {
        return this._game;
    }

    get map(): WorldMap {
        return this._game.map;
    }

    registerPrimedItem(item: Item): void {
        if (!item.primed || item.primed === "safe") {
            throw new Error(`Item ${item.id} is not primed`);
        }

        this._primedItems.set(item.id, item);
    }

    unregisterPrimedItem(item: Item): void {
        this._primedItems.delete(item.id);
    }

    triggerImmediate(): void {
        for (const item of this._primedItems.values()) {
            if (item.primed === "immediate") {
                // Trigger an explosion.
            }
        }
    }

    triggerEndTurn(): void {
        for (const item of this._primedItems.values()) {
            switch (item.primed) {
                case "safe":
                    continue;

                case "immediate":
                    // Trigger an explosion.
                    break;

                default:
                    if (typeof item.primed !== "number") {
                        throw new Error(`Item ${item.id} has an invalid primed value: ${item.primed}`);
                    }

                    if (--item.primed < 0) {
                        // Trigger an explosion.
                    }
                    break;
            }
        }
    }

    endTurn(): void {
        this.triggerEndTurn();
    }
}
