import { Description, RenderList } from "@atbs/shared-data";
import { Stack, SxProps, Typography } from "@mui/material";
import { DescriptionComponent } from "../Description";
import { ImageComponent } from "../Image";

export interface UnitDetailsComponentProps {
    unit: {
        name: string;
        uiImage: RenderList;
        description: Description;
    };
    noImages?: boolean;
    noDescription?: boolean;
    sx?: SxProps;
}

export function UnitDetailsComponent({
    unit,
    noImages = false,
    noDescription = false,
    sx
}: UnitDetailsComponentProps) {
    return (
        <Stack
            spacing={1}
            sx={{
                borderRadius: 2,
                border: "1px black solid",
                backgroundColor: "beige",
                rowGap: 1,
                p: 1,
                ...sx
            }}
        >
            <Typography variant="h5" sx={{ textAlign: "center", m: "auto" }}>
                {unit.name}
            </Typography>
            {!noImages && <ImageComponent images={unit.uiImage} />}
            {!noDescription && (
                <Stack spacing={1}>
                    <Typography variant="h6">Description:</Typography>
                    <DescriptionComponent description={unit.description} />
                </Stack>
            )}
        </Stack>
    );
}
