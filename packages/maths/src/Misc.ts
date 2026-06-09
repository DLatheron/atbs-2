import { v4 } from "uuid";

export function CastToArray<T>(singleValueOrArray: T | T[]): T[] {
    return Array.isArray(singleValueOrArray) ? singleValueOrArray : [singleValueOrArray];
}

export function ShuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

export enum ItemMoveDirection {
    SHIFT_LEFT = -1,
    DO_NOT_MOVE = 0,
    SHIFT_RIGHT = 1
}

export function RearrangeArrayWithAnimation(
    maxItems: number,
    indexOfGap: number,
    hoverOverIndex: number
): ItemMoveDirection[] {
    // Calculate the direction of gap relative to the item being moved. This determines the
    // predominant direction of movement, where:
    // -1 = left
    //  0 = on top of
    //  1 = right
    const directionFromHoverToGap = Math.sign(hoverOverIndex - indexOfGap);
    if (directionFromHoverToGap === 0) {
        // No need to move anything.
        return Array.from({ length: maxItems }, () => ItemMoveDirection.DO_NOT_MOVE);
    } else if (directionFromHoverToGap === -1) {
        // The gap is to the left of the current position.
        return Array.from({ length: maxItems }, (_, index) =>
            index >= hoverOverIndex && index < indexOfGap
                ? // We need to move the item and there is a gap to the right, so shift right.
                  ItemMoveDirection.SHIFT_RIGHT
                : ItemMoveDirection.DO_NOT_MOVE
        );
    } else {
        // The gap is to the right of the current position.
        return Array.from({ length: maxItems }, (_, index) =>
            index > indexOfGap && index <= hoverOverIndex
                ? // We need to move the item and there is a gap to the left, so shift it left.
                  ItemMoveDirection.SHIFT_LEFT
                : ItemMoveDirection.DO_NOT_MOVE
        );
    }
}

export interface ListItem {
    instanceId: string;
    key: string;
    index: number;
}

export function RearrangeArray<T extends ListItem>(
    items: T[],
    oldIndexOfItem: number,
    newIndexOfItem: number
): T[] {
    if (oldIndexOfItem === newIndexOfItem) {
        return items;
    }

    const itemToMove = items[oldIndexOfItem];
    const newItems = [...items];

    // Remove it from its old position.
    newItems.splice(oldIndexOfItem, 1);
    // Insert it into the new position.
    newItems.splice(newIndexOfItem, 0, itemToMove);

    // Update the items with their new indexes and unique keys (to force refresh).
    return newItems.map((item, index) => ({ ...item, index, key: v4() }));
}

export interface ListProps {
    maxIndex: number;
    initialContainerMargin: number;
    itemDimension: number;
    interItemGap: number;
}

export function CalculateOffsetFromIndex(
    index: number,
    { maxIndex, initialContainerMargin, itemDimension, interItemGap }: ListProps
): number {
    return (
        Math.min(index, maxIndex) * (itemDimension + interItemGap) +
        initialContainerMargin +
        itemDimension / 2
    );
}

export function CalculateIndexFromOffset(
    offset: number,
    { maxIndex, initialContainerMargin, itemDimension, interItemGap }: ListProps
): number {
    return Math.min(
        Math.floor((offset - initialContainerMargin) / (itemDimension + interItemGap)),
        maxIndex
    );
}

export function delay(delayInMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayInMs));
}
