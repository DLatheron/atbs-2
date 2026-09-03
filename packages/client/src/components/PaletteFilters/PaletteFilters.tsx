import {
    Box,
    Checkbox,
    FormControl,
    InputLabel,
    ListItemText,
    MenuItem,
    Select,
    SelectChangeEvent
} from "@mui/material";
import {
    PALETTE_FILTER_ALL,
    isAllFilter,
    nextMultiFilterValue
} from "../../helpers/paletteFilters";

export interface PaletteFiltersProps {
    tileSetOptions: string[];
    categoryOptions: string[];
    selectedTileSets: string[];
    selectedCategories: string[];
    onTileSetsChange: (tileSets: string[]) => void;
    onCategoriesChange: (categories: string[]) => void;
}

function FilterSelect({
    label,
    options,
    value,
    onChange
}: {
    label: string;
    options: string[];
    value: string[];
    onChange: (value: string[]) => void;
}) {
    const handleChange = (event: SelectChangeEvent<string[]>) => {
        const incoming = event.target.value;
        onChange(
            nextMultiFilterValue(
                value,
                typeof incoming === "string" ? [incoming] : incoming,
                options
            )
        );
    };

    return (
        <FormControl size="small" fullWidth>
            <InputLabel>{label}</InputLabel>
            <Select
                multiple
                label={label}
                value={value}
                onChange={handleChange}
                renderValue={(selected) => selected.join(", ")}
            >
                <MenuItem value={PALETTE_FILTER_ALL}>
                    <Checkbox checked={isAllFilter(value)} />
                    <ListItemText primary={PALETTE_FILTER_ALL} />
                </MenuItem>
                {options.map((option) => (
                    <MenuItem key={option} value={option}>
                        <Checkbox checked={!isAllFilter(value) && value.includes(option)} />
                        <ListItemText primary={option} />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

export function PaletteFilters({
    tileSetOptions,
    categoryOptions,
    selectedTileSets,
    selectedCategories,
    onTileSetsChange,
    onCategoriesChange
}: PaletteFiltersProps) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, flexShrink: 0, pt: 1 }}>
            <FilterSelect
                label="Tile Set"
                options={tileSetOptions}
                value={selectedTileSets}
                onChange={onTileSetsChange}
            />
            <FilterSelect
                label="Category"
                options={categoryOptions}
                value={selectedCategories}
                onChange={onCategoriesChange}
            />
        </Box>
    );
}
