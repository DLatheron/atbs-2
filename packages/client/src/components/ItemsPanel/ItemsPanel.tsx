import { Box, Typography } from "@mui/material";
import { ItemPaletteEntry, ItemPaletteWire, RenderList, SelectedItem } from "@atbs/shared-data";
import { ImageComponent } from "../Image";

const TILE_SIZE = 64;

export interface ItemsPanelProps {
    itemPalette: ItemPaletteWire;
    selectedItem: SelectedItem;
    onSelectedItemChange: (selectedItem: SelectedItem) => void;
}

function ItemSelectionGrid({
    items,
    selectedIndex,
    onSelectionChanged
}: {
    items: ItemPaletteEntry[];
    selectedIndex: number;
    onSelectionChanged: (index: number) => void;
}) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
                overflowY: "auto"
            }}
        >
            {items.map((item, index) => {
                const selected = index === selectedIndex;
                return (
                    <Box
                        key={item.id}
                        onClick={() => onSelectionChanged(index)}
                        title={item.name}
                        sx={{
                            border: selected ? "2px solid #1e90ff" : "1px solid #ccc",
                            cursor: "pointer",
                            p: 0.5
                        }}
                    >
                        <ImageComponent
                            images={item.uiImage}
                            width={TILE_SIZE}
                            height={TILE_SIZE}
                        />
                    </Box>
                );
            })}
        </Box>
    );
}

export function ItemsPanel({ itemPalette, selectedItem, onSelectedItemChange }: ItemsPanelProps) {
    const item = itemPalette.items[selectedItem.index];

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            <Typography variant="subtitle2" sx={{ textAlign: "center" }}>
                {item?.name ?? "Empty"}
            </Typography>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                <ItemSelectionGrid
                    items={itemPalette.items}
                    selectedIndex={selectedItem.index}
                    onSelectionChanged={(index) => onSelectedItemChange({ index })}
                />
            </Box>

            {item ? (
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <ImageComponent
                        images={item.uiImage satisfies RenderList}
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                    />
                </Box>
            ) : null}

            <Typography variant="caption" color="text.secondary">
                Click a tile to place the selected item. Alt+click to remove items from a tile.
            </Typography>
        </Box>
    );
}
