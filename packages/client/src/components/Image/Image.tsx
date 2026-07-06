import { Container, SxProps } from "@mui/material";
import { RenderList } from "@atbs/shared-data";
import { Orientation, OrientationToCSSTransform, rotateOrientation } from "@atbs/maths";
import { ReactNode } from "react";
import { useImageSrc } from "../../hooks/useImageSrc";

export interface ImageComponentProps {
    images: RenderList;
    width?: number;
    height?: number;
    children?: ReactNode;
    disabled?: boolean;
    sx?: SxProps;
}

interface RenderImageLayerProps {
    imageId: string;
    orientation: Orientation;
    opacity: number;
    width: number;
    height: number;
    disabled: boolean;
}

function RenderImageLayer({
    imageId,
    orientation,
    opacity,
    width,
    height,
    disabled
}: RenderImageLayerProps) {
    const src = useImageSrc(imageId);

    return (
        <img
            src={src}
            width={width}
            height={height}
            alt={imageId}
            style={{
                gridArea: "images",
                margin: "auto",
                padding: 0,
                opacity,
                transform:
                    OrientationToCSSTransform[rotateOrientation(Orientation.NORTH, orientation)],
                ...(disabled && { filter: "grayscale(100%)", opacity: 0.5 })
            }}
            draggable={false}
        />
    );
}

export function ImageComponent({
    images,
    width = 100,
    height = 100,
    children,
    disabled = false,
    sx
}: ImageComponentProps) {
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
                <RenderImageLayer
                    key={`${imageId}-${index}`}
                    imageId={imageId}
                    orientation={orientation}
                    opacity={opacity}
                    width={width}
                    height={height}
                    disabled={disabled}
                />
            ))}
            {children}
        </Container>
    );
}
