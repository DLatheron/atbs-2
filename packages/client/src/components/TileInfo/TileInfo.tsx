import { TileInfo } from "@atbs/shared-data";
import { Container, Stack, SxProps, Typography } from "@mui/material";
import { DescriptionComponent } from "../Description/Description";
import { ImageComponent } from "../Image/Image";

export interface TileInfoComponentProps {
    tileInfo: TileInfo | null;
    sx?: SxProps;
}

export function TileInfoComponent({ tileInfo, sx }: TileInfoComponentProps) {
    const unit = tileInfo?.unit;
    const terrain = tileInfo?.terrain;

    return (
        <Container data-testid="tile-info-component" disableGutters maxWidth={false} sx={sx}>
            {tileInfo && (
                <Stack direction="column" spacing={2}>
                    {terrain && (
                        <>
                            <Typography variant="h5">Terrain:</Typography>
                            <ImageComponent images={terrain.uiImage} />
                            <Typography variant="h6">{terrain.name}</Typography>
                            <DescriptionComponent description={terrain.description} />
                        </>
                    )}
                    <hr />
                    <Typography variant="h5">Unit:</Typography>
                    {unit ? (
                        <>
                            <Typography variant="h6">{unit.name}</Typography>
                            <ImageComponent images={unit.uiImage} />
                            <DescriptionComponent description={unit.description} />
                        </>
                    ) : (
                        <Typography variant="body1">No unit</Typography>
                    )}
                </Stack>
            )}
        </Container>
    );
}
