const top = 0;
const parent = (i: number) => ((i + 1) >>> 1) - 1;
const left = (i: number) => (i << 1) + 1;
const right = (i: number) => (i + 1) << 1;

export interface Priority {
    priority: number;
}

export const HighestFirst = (a: Priority, b: Priority) => a.priority > b.priority;
export const LowestFirst = (a: Priority, b: Priority) => a.priority < b.priority;

export class PriorityQueue<T extends Priority> {
    private readonly _heap: T[];
    private readonly _comparator: (a: T, b: T) => boolean;

    constructor(comparator = HighestFirst) {
        this._heap = [];
        this._comparator = comparator;
    }

    get length(): number {
        return this._heap.length;
    }

    get isEmpty(): boolean {
        return this.length == 0;
    }

    peek(): T {
        return this._heap[top];
    }

    push(...values: T[]): number {
        values.forEach((value) => {
            this._heap.push(value);
            this._siftUp();
        });
        return this.length;
    }

    pop(): T {
        const poppedValue = this.peek();
        const bottom = this.length - 1;
        if (bottom > top) {
            this._swap(top, bottom);
        }
        this._heap.pop();
        this._siftDown();
        return poppedValue;
    }

    replace(value: T): T {
        const replacedValue = this.peek();
        this._heap[top] = value;
        this._siftDown();
        return replacedValue;
    }

    _greater(i: number, j: number): boolean {
        return this._comparator(this._heap[i], this._heap[j]);
    }

    _swap(i: number, j: number): void {
        [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
    }

    _siftUp(): void {
        let node = this.length - 1;
        while (node > top && this._greater(node, parent(node))) {
            this._swap(node, parent(node));
            node = parent(node);
        }
    }

    _siftDown(): void {
        let node = top;

        while (
            (left(node) < this.length && this._greater(left(node), node)) ||
            (right(node) < this.length && this._greater(right(node), node))
        ) {
            const maxChild =
                right(node) < this.length && this._greater(right(node), left(node))
                    ? right(node)
                    : left(node);
            this._swap(node, maxChild);
            node = maxChild;
        }
    }
}
