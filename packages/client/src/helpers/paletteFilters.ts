export const PALETTE_FILTER_ALL = "All";

export function isAllFilter(selected: string[]): boolean {
    return selected.length === 0 || selected.includes(PALETTE_FILTER_ALL);
}

export function matchesSelectedFilters(value: string, selected: string[]): boolean {
    return isAllFilter(selected) || selected.includes(value);
}

export function uniqueSorted(values: Iterable<string>): string[] {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function nextMultiFilterValue(
    previous: string[],
    incoming: string[],
    allOptions: string[]
): string[] {
    const previousIsAll = isAllFilter(previous);
    const incomingHasAll = incoming.includes(PALETTE_FILTER_ALL);

    if (incomingHasAll && !previousIsAll) {
        return [PALETTE_FILTER_ALL];
    }

    const specific = incoming.filter((value) => value !== PALETTE_FILTER_ALL);
    if (specific.length === 0 || specific.length === allOptions.length) {
        return [PALETTE_FILTER_ALL];
    }

    return specific;
}

export function itemMatchesPaletteFilters(
    item: { tileSet: string; category: string },
    tileSets: string[],
    categories: string[]
): boolean {
    return (
        matchesSelectedFilters(item.tileSet, tileSets) &&
        matchesSelectedFilters(item.category, categories)
    );
}
