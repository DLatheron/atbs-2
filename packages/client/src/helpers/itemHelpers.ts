import { ItemPaletteWire, SelectedItem } from "@atbs/shared-data";

export function createDefaultSelectedItem(): SelectedItem {
    return { index: 0 };
}

export function getItemId(
    itemPalette: ItemPaletteWire,
    selectedItem: SelectedItem
): string | undefined {
    return itemPalette.items[selectedItem.index]?.id;
}
