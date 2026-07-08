import { TileInfo } from "@atbs/shared-data";
import { Container, Stack, SxProps, Typography } from "@mui/material";
import { DescriptionComponent } from "../Description/Description";
import { ImageComponent } from "../Image/Image";
import { UnitDetailsComponent } from "../UnitDetails";
import { formatPercentage } from "../../helpers/formattingHelpers";
import { AttributesComponent } from "../Attributes";

export interface TileInfoComponentProps {
    tileInfo: TileInfo | null;
    sx?: SxProps;
}

export function TileInfoComponent({ tileInfo, sx }: TileInfoComponentProps) {
    const item = tileInfo?.item;
    const unit = tileInfo?.unit;
    const terrain = tileInfo?.terrain;
    const furniture = tileInfo?.furniture;

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
                            {furniture && (
                                <>
                                    <Typography variant="h5" sx={{ textAlign: "center" }}>
                                        {furniture.name}{" "}
                                    </Typography>
                                    <ImageComponent images={furniture.uiImage} />
                                    <DescriptionComponent description={furniture.description} />
                                    {furniture.integrity && (
                                        <AttributesComponent
                                            attributes={[
                                                {
                                                    id: "integrity",
                                                    label: "Integrity",
                                                    value: formatPercentage(furniture.integrity)
                                                }
                                            ]}
                                        />
                                    )}
                                </>
                            )}
                            {item && (
                                <>
                                    <Typography variant="h5" sx={{ textAlign: "center" }}>
                                        {item.name}{" "}
                                    </Typography>
                                    <ImageComponent images={item.uiImage} />
                                    <DescriptionComponent description={item.description} />
                                </>
                            )}
                        </Stack>
                    )}
                    {unit && <UnitDetailsComponent unit={unit} />}
                </Stack>
            )}
        </Container>
    );
}
