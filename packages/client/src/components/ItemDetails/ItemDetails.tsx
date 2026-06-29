import { ItemSummary } from "@atbs/shared-data";
import { Box, Stack, SxProps, Typography } from "@mui/material";
import { DescriptionComponent } from "../Description";
import { ImageComponent } from "../Image";

export interface ItemDetailsComponentProps {
    title?: string;
    item: ItemSummary | null;
    noImages?: boolean;
    noDescription?: boolean;
    sx?: SxProps;
}

export function ItemDetailsComponent({
    title,
    item,
    noImages = false,
    noDescription = false,
    sx
}: ItemDetailsComponentProps) {
    if (!item) {
        return null;
    }

    return (
        <Box
            sx={{
                borderRadius: 2,
                border: "1px black solid",
                display: "grid",
                backgroundColor: "beige",
                gridTemplateAreas: `
                    'title'
                    'name'
                    'image'
                    'description'
                `,
                gridTemplateRows: "minmax(0, auto) auto minmax(0, auto) minmax(0, auto)",
                rowGap: 2,
                p: 1,
                ...sx
            }}
        >
            {item && (
                <>
                    {title && (
                        <Typography variant="h5" sx={{ gridArea: "title", m: "auto" }}>
                            {title}
                        </Typography>
                    )}
                    <Typography variant="h6" sx={{ gridArea: "name", m: "auto" }}>
                        {item.name}
                    </Typography>
                    {!noImages && (
                        <ImageComponent images={item.uiImage} sx={{ gridArea: "image" }} />
                    )}
                    {!noDescription && (
                        <Stack sx={{ gridArea: "description" }} spacing={1}>
                            <Typography variant="h6">Description:</Typography>
                            <DescriptionComponent description={item.description} />
                        </Stack>
                    )}
                </>
            )}
        </Box>
    );
}
