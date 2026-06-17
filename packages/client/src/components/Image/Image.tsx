import { Container, SxProps } from "@mui/material";
import { useImageCache } from "../../hooks/useImageCache";
import { RenderList } from "@atbs/shared-data";
import { Orientation, OrientationToCSSTransform, rotateOrientation } from "@atbs/maths";
import { ReactNode } from "react";

export interface ImageComponentProps {
    images: RenderList;
    width?: number;
    height?: number;
    children?: ReactNode;
    disabled?: boolean;
    sx?: SxProps;
}

export function ImageComponent({
    images,
    width = 100,
    height = 100,
    children,
    disabled = false,
    sx
}: ImageComponentProps) {
    const { imageCache } = useImageCache();

    return (
        <Container
            data-testid="image-component"
            disableGutters
            maxWidth={false}
            sx={{
                display: "grid",
                gridTemplateAreas: "'images'",
                ...sx
            }}
        >
            {images.map(({ imageId, orientation = Orientation.NORTH, opacity = 1 }, index) => (
                <img
                    key={`${imageId}-${index}`}
                    src={imageCache.getDataSafe(imageId)}
                    width={width}
                    height={height}
                    alt={imageId ?? "empty"}
                    style={{
                        gridArea: "images",
                        margin: "auto",
                        padding: 0,
                        opacity,
                        transform:
                            OrientationToCSSTransform[
                                rotateOrientation(Orientation.NORTH, orientation)
                            ],
                        ...(disabled && { filter: "grayscale(100%)", opacity: 0.5 })
                    }}
                    draggable={false}
                />
            ))}
            {children}
        </Container>
    );
}
