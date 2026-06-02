import { ReactNode, useEffect, useRef } from "react";

import { CanvasLoopComponent, CanvasLoopComponentProps } from "../CanvasLoop";
import { useComponentSize } from "../../hooks";
import { Container } from "@mui/material";

export interface MapComponentProps {
    renderMap?: (props: CanvasLoopComponentProps) => void;
    // onMouseEnter?: (event: React.MouseEvent) => void;
    // onMouseLeave?: (event: React.MouseEvent) => void;
    // onMouseMove?: (event: React.MouseEvent) => void;
    // onMouseUp?: (event: React.MouseEvent) => void;
    // onMouseDown?: (event: React.MouseEvent) => void;
    // onClick?: (event: React.MouseEvent) => void;
    // onDoubleClick?: (event: React.MouseEvent) => void;
    // disabled?: boolean;
    // cursor?: string;
    children?: ReactNode;
}

export function MapComponent({
    renderMap,
    // onMouseEnter,
    // onMouseLeave,
    // onMouseMove,
    // onMouseUp,
    // onMouseDown,
    // onClick,
    // onDoubleClick,
    // disabled = false,
    // cursor = "default",
    children
}: MapComponentProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const { width, height } = useComponentSize(containerRef);

    useEffect(() => {
        CanvasLoopComponent(canvasRef, (props) => renderMap?.(props));
    }, [renderMap]);

    return (
        <Container
            data-testid="map-component"
            maxWidth={false}
            sx={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                m: 0,
                p: 0,
                position: "relative",
                userSelect: "none",
                zIndex: 1,
                backgroundColor: "pink"
            }}
            disableGutters
            ref={containerRef}
        >
            <canvas
                id="main-map"
                ref={canvasRef}
                width={width}
                height={height}
                // onMouseEnter={onMouseEnter}
                // onMouseLeave={onMouseLeave}
                // onMouseMoveCapture={onMouseMove}
                // onMouseUpCapture={onMouseUp}
                // onMouseDownCapture={onMouseDown}
                // onClickCapture={onClick}
                // onDoubleClickCapture={onDoubleClick}
                onContextMenuCapture={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.nativeEvent.stopPropagation();
                }}
                style={{
                    margin: 0,
                    padding: 0
                }}
            />
            {children}
        </Container>
    );
}
