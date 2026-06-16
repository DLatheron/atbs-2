import { UnitSummary } from "@atbs/shared-data";
import { Box, Container, Stack, SxProps, Typography } from "@mui/material";
import { DescriptionComponent } from "../Description";
import { ImageComponent } from "../Image";

export interface UnitDetailsComponentProps {
    unit: UnitSummary;
    noImages?: boolean;
    noDescription?: boolean;
    sx?: SxProps;
}

export function UnitDetailsComponent({ unit, noImages = false, noDescription = false, sx }: UnitDetailsComponentProps) {
    return (
        <Box
            sx={{
                borderRadius: 2,
                border: "1px black solid",
                display: "grid",
                backgroundColor: "beige",
                gridTemplateAreas: `
                    'name'
                    'image'
                    'description'
                `,
                gridTemplateRows: "auto minmax(0, auto) minmax(0, auto)",
                rowGap: 2,
                p: 1,
                ...sx
            }}
        >
            {unit && (
                <>
                    <Typography variant="h5" sx={{ gridArea: "name", m: "auto" }}>{unit.name}</Typography>
                    {!noImages && <ImageComponent images={unit.uiImage} sx={{ gridArea: "image"}}/>}
                    {!noDescription && (
                        <Stack sx={{gridArea: "description"}} spacing={1}>
                            <Typography variant="h6">Description:</Typography>
                            <DescriptionComponent description={unit.description} />
                        </Stack>
                    )}
                </>
            )}
        </Box>
    );
}
