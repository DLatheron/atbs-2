import { Box, SxProps, Typography } from "@mui/material";
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
                borderRadius: 2,
                border: "1px black solid",
                display: "grid",
                backgroundColor: "beige",
                gridTemplateAreas: `
                    'title'
                    'direction'
                `,
                gridTemplateRows: "auto auto",
                gridTemplateColumns: "auto 1fr auto",
                p: 1,
                columnGap: 2,
                rowGap: 1,
                ...sx
            }}
        >
            <Typography variant="h6" sx={{ gridArea: "title", m: "auto", gridColumn: "1/4" }}>
                Attributes
            </Typography>

            {attributes.map(({ id, label, text, value }) => (
                <AttributeComponent key={id} id={id} label={label} text={text} value={value} />
            ))}
        </Box>
    );
}
