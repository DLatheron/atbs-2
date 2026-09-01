import { Box } from "@mui/material";
import { TilePos } from "@atbs/maths";
import { EditorMapWire } from "@atbs/shared-data";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorWorld } from "../../EditorWorld";
import { useImageCache } from "../../hooks/useImageCache";
import {
    clientPositionToTilePos,
    drawMinimapTiles,
    drawMinimapViewport,
    getMinimapTilePixelSize,
    minimapEventToTilePos
} from "./editorMinimapDrawing";

export interface EditorMinimapProps {
    map: EditorMapWire | null;
    world: EditorWorld;
}

interface PaintDragState {
    lastTilePos?: TilePos;
}

export function EditorMinimap({ map, world }: EditorMinimapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tileLayerRef = useRef<HTMLCanvasElement | null>(null);
    const paintDragRef = useRef<PaintDragState | null>(null);
    const mapRef = useRef(map);
    const containerWidthRef = useRef(0);
    const worldRef = useRef(world);
    const { imageCache } = useImageCache();
    const [containerWidth, setContainerWidth] = useState(0);
    const [tileLayerVersion, setTileLayerVersion] = useState(0);

    mapRef.current = map;
    containerWidthRef.current = containerWidth;
    worldRef.current = world;

    const paintAtClientPosition = useCallback(
        (clientX: number, clientY: number, altKey: boolean) => {
            const currentMap = mapRef.current;
            const canvas = canvasRef.current;
            if (!currentMap || !canvas) {
                return;
            }

            const tilePixelSize = getMinimapTilePixelSize(
                currentMap.width,
                containerWidthRef.current
            );
            const tilePos = clientPositionToTilePos(
                canvas,
                clientX,
                clientY,
                currentMap,
                tilePixelSize
            );
            if (!tilePos) {
                return;
            }

            const drag = paintDragRef.current;
            if (drag?.lastTilePos && TilePos.IsEqual(drag.lastTilePos, tilePos)) {
                return;
            }

            if (drag) {
                drag.lastTilePos = tilePos;
            }

            worldRef.current.paintAtTile(tilePos, { altKey });
        },
        []
    );

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        observer.observe(container);
        setContainerWidth(container.clientWidth);

        return () => observer.disconnect();
    }, []);

    const redrawTileLayer = useCallback(() => {
        if (!map) {
            tileLayerRef.current = null;
            return;
        }

        const tilePixelSize = getMinimapTilePixelSize(map.width, containerWidth);
        const offscreen = document.createElement("canvas");
        offscreen.width = map.width * tilePixelSize;
        offscreen.height = map.height * tilePixelSize;

        const context = offscreen.getContext("2d");
        if (!context) {
            return;
        }

        drawMinimapTiles(context, map, imageCache, tilePixelSize);
        tileLayerRef.current = offscreen;
        setTileLayerVersion((version) => version + 1);
    }, [map, containerWidth, imageCache]);

    useEffect(() => {
        redrawTileLayer();
    }, [redrawTileLayer]);

    useEffect(() => {
        const unsubscribe = imageCache.subscribeAny(() => {
            redrawTileLayer();
        });
        return unsubscribe;
    }, [imageCache, redrawTileLayer]);

    useEffect(() => {
        if (!map || containerWidth <= 0) {
            return;
        }

        const tilePixelSize = getMinimapTilePixelSize(map.width, containerWidth);
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        canvas.width = map.width * tilePixelSize;
        canvas.height = map.height * tilePixelSize;

        let frameId = 0;

        const drawFrame = () => {
            const context = canvas.getContext("2d");
            if (!context) {
                frameId = requestAnimationFrame(drawFrame);
                return;
            }

            context.clearRect(0, 0, canvas.width, canvas.height);

            const tileLayer = tileLayerRef.current;
            if (tileLayer) {
                context.drawImage(tileLayer, 0, 0);
            }

            drawMinimapViewport(context, world, tilePixelSize);
            frameId = requestAnimationFrame(drawFrame);
        };

        frameId = requestAnimationFrame(drawFrame);

        return () => cancelAnimationFrame(frameId);
    }, [map, containerWidth, world, tileLayerVersion]);

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            if (!paintDragRef.current || (event.buttons & 1) === 0) {
                return;
            }

            paintAtClientPosition(event.clientX, event.clientY, event.altKey);
        };

        const endPaintDrag = (event: MouseEvent) => {
            if (event.button === 0) {
                paintDragRef.current = null;
            }
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", endPaintDrag);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", endPaintDrag);
        };
    }, [paintAtClientPosition]);

    const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!map) {
            return;
        }

        const tilePixelSize = getMinimapTilePixelSize(map.width, containerWidth);
        const tilePos = minimapEventToTilePos(event, map, tilePixelSize);
        if (!tilePos) {
            return;
        }

        if (event.button === 2) {
            event.preventDefault();
            world.panToTile(tilePos);
            return;
        }

        if (event.button === 0) {
            paintDragRef.current = {};
            paintAtClientPosition(event.clientX, event.clientY, event.altKey);
        }
    };

    if (!map || containerWidth <= 0) {
        return <Box ref={containerRef} sx={{ width: "100%", minHeight: 8 }} />;
    }

    const tilePixelSize = getMinimapTilePixelSize(map.width, containerWidth);

    return (
        <Box
            ref={containerRef}
            sx={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                mb: 1,
                borderBottom: 1,
                borderColor: "divider",
                pb: 1
            }}
        >
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onContextMenu={(event) => event.preventDefault()}
                style={{
                    display: "block",
                    width: map.width * tilePixelSize,
                    height: map.height * tilePixelSize,
                    imageRendering: "pixelated",
                    cursor: "crosshair"
                }}
            />
        </Box>
    );
}
