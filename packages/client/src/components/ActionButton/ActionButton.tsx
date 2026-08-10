import { Orientation } from "@atbs/maths";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import React from "react";
import { ImageComponent } from "../Image";
import { SxProps } from "@mui/material/styles";

export interface ActionButtonComponentProps {
    name: string;
    className?: string;
    tileSize: number;
    rotation?: Orientation;
    toggled?: boolean;
    disabled?: boolean;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    anchorRef?: React.Ref<HTMLDivElement>;
    sx?: SxProps;
    children?: React.ReactNode;
}

export function ActionButtonComponent({
    name,
    tileSize,
    className,
    // size = "regular",
    // rotation = Orientation.NORTH,
    // toggled = undefined,
    disabled = false,
    onClick = undefined,
    anchorRef = undefined,
    sx,
    children
}: ActionButtonComponentProps) {
    const buttonSize = tileSize / 2;
    const imageSize = buttonSize * 0.8;

    return (
        <Box sx={{ ...sx, m: "auto", boxShadow: "0 0 20px rgba(0, 0, 0, 0.5)" }}>
            <Button
                className={className}
                disabled={disabled || !onClick}
                onClick={(event) => {
                    if (onClick) {
                        onClick(event);
                        event.stopPropagation();
                    }
                }}
                variant="outlined"
                draggable={false}
                sx={{
                    p: 0,
                    m: 0,
                    width: buttonSize,
                    height: buttonSize,
                    minWidth: buttonSize,
                    minHeight: buttonSize,
                    backgroundColor: "rgb(0, 123, 255)",
                    border: "1px solid black",
                    pointerEvents: "auto"
                }}
            >
                <ImageComponent
                    images={[{ imageId: name }]}
                    width={imageSize}
                    height={imageSize}
                    // disabled={disabled || !unit.interactions.canInventory}
                />
            </Button>
            {<Container ref={anchorRef}>{children}</Container>}
        </Box>
    );
}
