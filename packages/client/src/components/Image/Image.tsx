import { Container, SxProps } from "@mui/material";
import { RenderList } from "@atbs/shared-data";
import { Orientation, OrientationToCSSTransform, rotateOrientation } from "@atbs/maths";
import { ReactNode } from "react";
import { useImageSrc } from "../../hooks/useImageSrc";

/** Matches the grey used in compound-terrain previews (background / foreground mix). */
const BLEND_MASK_BASE_COLOUR = "#888888";

const CHECKERBOARD_BACKGROUND = {
    backgroundColor: "#ffffff",
    backgroundImage:
        "linear-gradient(45deg, #c8c8c8 25%, transparent 25%), linear-gradient(-45deg, #c8c8c8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #c8c8c8 75%), linear-gradient(-45deg, transparent 75%, #c8c8c8 75%)",
    backgroundSize: "12px 12px",
    backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px"
};

function usesTransparency(images: RenderList): boolean {
    return images.some(
        ({ imageId }) => imageId === "transparent" || imageId.includes("transparent[")
    );
}

export interface ImageComponentProps {
    images: RenderList;
    width?: number;
    height?: number;
    children?: ReactNode;
    disabled?: boolean;
    /** Blend-mask PNGs use alpha to mix white over a grey base in the picker preview. */
    blendMask?: boolean;
    /** Force a checkerboard behind the image (useful for alpha previews). */
    checkerboard?: boolean;
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
    blendMask = false,
    checkerboard = false,
    sx
}: ImageComponentProps) {
    const showCheckerboard = checkerboard || usesTransparency(images);

    return (
        <Container
            data-testid="image-component"
            disableGutters
            maxWidth={false}
            sx={{
                display: "grid",
                gridTemplateAreas: "'images'",
                width,
                height,
                ...(blendMask && { bgcolor: BLEND_MASK_BASE_COLOUR }),
                ...(showCheckerboard && !blendMask ? CHECKERBOARD_BACKGROUND : null),
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
