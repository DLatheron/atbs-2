import { Box, SxProps } from "@mui/material";
import { AttributeComponent, AttributeComponentProps } from "../Attribute";

export interface AttributesComponentProps {
    attributes: AttributeComponentProps[];
    sx?: SxProps;
}

export function AttributesComponent({ attributes, sx }: AttributesComponentProps) {
    return (
        <Box
            data-testid="attributes-component"
            sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                columnGap: 2,
                rowGap: 1,
                ...sx
            }}
        >
            {attributes.map(({ id, label, text, value }) => (
                <AttributeComponent key={id} id={id} label={label} text={text} value={value} />
            ))}
        </Box>
    );
}
