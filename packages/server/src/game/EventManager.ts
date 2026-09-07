import type { Item } from "./Item.js";
import type { Unit } from "./Unit.js";
import type { Furniture } from "./Furniture.js";
import type { Side } from "./Side.js";

/** Event name → listener args (tuple = multiple params) */
export type GameEvents = {
    unitKilled: [unit: Unit];
    sideEliminated: [side: Side];
    furnitureDestroyed: [furniture: Furniture];
    furnitureAction: [furniture: Furniture, actionName: string, actor: Unit, itemUsed: Item | null];
    itemDropped: [item: Item];
    itemPickedUp: [item: Item, unit: Unit];
    unitEnteredZone: [unit: Unit, zoneId: string];
    itemEnteredZone: [item: Item, zoneId: string, carrier: Unit | null];
    turnEnded: [turnNumber: number];
};

type Listener<Args extends unknown[]> = (...args: Args) => void;

export class EventManager {
    private listeners: {
        [K in keyof GameEvents]?: Listener<GameEvents[K]>[];
    } = {};

    public register<K extends keyof GameEvents>(event: K, listener: Listener<GameEvents[K]>): void {
        const list = (this.listeners[event] ?? []) as Listener<GameEvents[K]>[];
        list.push(listener);
        this.listeners[event] = list as (typeof this.listeners)[K];
    }

    public unregister<K extends keyof GameEvents>(
        event: K,
        listener: Listener<GameEvents[K]>
    ): void {
        const list = this.listeners[event] as Listener<GameEvents[K]>[] | undefined;
        if (!list) return;
        this.listeners[event] = list.filter((l) => l !== listener) as (typeof this.listeners)[K];
    }

    public on<K extends keyof GameEvents>(event: K, ...args: GameEvents[K]): void {
        const list = this.listeners[event] as Listener<GameEvents[K]>[] | undefined;
        list?.forEach((listener) => listener(...args));
    }
}
