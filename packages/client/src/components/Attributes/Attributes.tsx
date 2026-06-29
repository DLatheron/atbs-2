import { Box, SxProps, Typography } from "@mui/material";
import { AttributeComponent, AttributeComponentProps } from "../Attribute";

export interface AttributesComponentProps {
    title?: string;
    attributes: AttributeComponentProps[];
    surround?: boolean;
    sx?: SxProps;
}

export function AttributesComponent({
    title,
    attributes,
    surround = false,
    sx
}: AttributesComponentProps) {
    const surroundProps = {
        borderRadius: 2,
        border: "1px black solid",
        backgroundColor: "beige",
        p: 1
    };

    return (
        <Box
            data-testid="attributes-component"
            sx={{
                ...(surround && surroundProps),
                display: "grid",
                gridTemplateAreas: `
                    'title'
                    'direction'
                `,
                gridTemplateRows: "minmax(0, auto) auto",
                gridTemplateColumns: "auto 1fr auto",
                columnGap: 2,
                rowGap: 1,
                ...sx
            }}
        >
            {title && (
                <Typography variant="h6" sx={{ gridArea: "title", m: "auto", gridColumn: "1/4" }}>
                    {title}
                </Typography>
            )}

            {attributes.map(({ id, label, text, value }) => (
                <AttributeComponent key={id} id={id} label={label} text={text} value={value} />
            ))}
        </Box>
    );
}
