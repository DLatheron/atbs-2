export interface ArrayMembershipPartition<T> {
    onlyInFirst: T[];
    onlyInSecond: T[];
    inBoth: T[];
}

/**
 * Partitions two arrays by membership using reference equality (via Set).
 * Preserves order and duplicates from each source array in the corresponding result.
 */
export function partitionArrayMembership<T>(
    first: readonly T[],
    second: readonly T[]
): ArrayMembershipPartition<T> {
    const secondSet = new Set(second);
    const firstSet = new Set(first);

    return {
        onlyInFirst: first.filter((item) => !secondSet.has(item)),
        onlyInSecond: second.filter((item) => !firstSet.has(item)),
        inBoth: first.filter((item) => secondSet.has(item))
    };
}
