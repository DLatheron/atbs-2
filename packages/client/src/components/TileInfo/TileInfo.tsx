import { TileInfo } from "@atbs/shared-data";
import { Container, Stack, SxProps, Typography } from "@mui/material";
import { DescriptionComponent } from "../Description/Description";
import { ImageComponent } from "../Image/Image";
import { UnitDetailsComponent } from "../UnitDetails";

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
                        <Stack
                            spacing={2}
                            sx={{
                                borderRadius: 2,
                                border: "1px black solid",
                                backgroundColor: "beige",
                                p: 1
                            }}
                        >
                            <Typography variant="h5" sx={{ textAlign: "center" }}>
                                {terrain.name}{" "}
                            </Typography>
                            <ImageComponent images={terrain.uiImage} />
                            <DescriptionComponent description={terrain.description} />
                        </Stack>
                    )}
                    {unit && <UnitDetailsComponent unit={unit} />}
                </Stack>
            )}
        </Container>
    );
}
