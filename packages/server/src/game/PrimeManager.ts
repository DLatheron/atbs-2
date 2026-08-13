import { InstanceId } from "@atbs/shared-data";
import type { Item } from "./Item.js";
import type { Game } from "./Game.js";
import type { WorldMap } from "./WorldMap.js";
import type { Unit } from "./Unit.js";
import {
    broadcastExplosionTrace,
    consumeExplodedItem,
    detonateExplosion,
    type ExplosionDetonationResult
} from "./ExplosionSystem.js";

export class PrimeManager {
    private readonly _game: Game;
    private readonly _primedItems: Map<InstanceId, Item>;
    private readonly _primedBy: Map<InstanceId, Unit>;

    constructor(game: Game) {
        this._game = game;
        this._primedItems = new Map<InstanceId, Item>();
        this._primedBy = new Map<InstanceId, Unit>();
    }

    get game(): Game {
        return this._game;
    }

    get map(): WorldMap {
        return this._game.map;
    }

    registerPrimedItem(item: Item, primedBy?: Unit): void {
        if (item.primed === undefined || item.primed === "safe") {
            throw new Error(`Item ${item.id} is not primed`);
        }

        this._primedItems.set(item.id, item);
        if (primedBy) {
            this._primedBy.set(item.id, primedBy);
        }
    }

    unregisterPrimedItem(item: Item): void {
        this._primedItems.delete(item.id);
        this._primedBy.delete(item.id);
    }

    getPrimedBy(item: Item): Unit | undefined {
        return this._primedBy.get(item.id);
    }

    private _resolveDetonationOrigin(item: Item, primedBy: Unit | undefined): {
        origin: ReturnType<WorldMap["tileCenterToWorld"]>;
        firingUnit: Unit;
    } {
        if (item.location) {
            if (!primedBy) {
                throw new Error(`Primed ground item ${item.id} has no primedBy unit`);
            }
            return {
                origin: this.map.tileCenterToWorld(item.location),
                firingUnit: primedBy
            };
        }

        if (!primedBy) {
            throw new Error(`Primed item ${item.id} has no location and no primedBy unit`);
        }

        return {
            origin: this.map.tileCenterToWorld(primedBy.mapLocation),
            firingUnit: primedBy
        };
    }

    private _detonatePrimedItem(item: Item): ExplosionDetonationResult | null {
        if (!item.willExplode) {
            this.unregisterPrimedItem(item);
            return null;
        }

        const explosion = item.getExplosion;
        const primedBy = this.getPrimedBy(item);
        const { origin, firingUnit } = this._resolveDetonationOrigin(item, primedBy);
        const { tileUpdates: consumeUpdates } = consumeExplodedItem(this.game, item, primedBy, 0);

        const result = detonateExplosion({
            game: this.game,
            origin,
            explosion,
            firingUnit,
            firingWeapon: item,
            timeOffsetMs: 0
        });

        result.tileUpdates = [...consumeUpdates, ...result.tileUpdates].sort(
            (a, b) => a.timeMs - b.timeMs
        );

        return result;
    }

    triggerImmediate(): void {
        const toDetonate = [...this._primedItems.values()].filter(
            (item) => item.primed === "immediate"
        );

        for (const item of toDetonate) {
            const result = this._detonatePrimedItem(item);
            if (result) {
                broadcastExplosionTrace(this.game, result);
            }
        }
    }

    triggerEndTurn(): void {
        const primedSnapshot = [...this._primedItems.values()];

        for (const item of primedSnapshot) {
            switch (item.primed) {
                case "safe":
                    continue;

                case "immediate": {
                    const result = this._detonatePrimedItem(item);
                    if (result) {
                        broadcastExplosionTrace(this.game, result);
                    }
                    break;
                }

                default:
                    if (typeof item.primed !== "number") {
                        throw new Error(
                            `Item ${item.id} has an invalid primed value: ${item.primed}`
                        );
                    }

                    if (--item.primed < 0) {
                        const result = this._detonatePrimedItem(item);
                        if (result) {
                            broadcastExplosionTrace(this.game, result);
                        }
                    }
                    break;
            }
        }
    }

    endTurn(): void {
        this.triggerEndTurn();
    }
}
