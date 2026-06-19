import { TilePos, Vec2 } from "@atbs/maths";

export interface IInteractionHandler {
    get cursorWorldPos(): Vec2 | null;

    initialise: () => void;
    uninitialse: () => void;

    update?: ({ time, frameDelta }: { time: number; frameDelta: number }) => void;

    onMouseEnter?: (event: MouseEvent | React.MouseEvent) => void;
    onMouseLeave?: (event: MouseEvent | React.MouseEvent) => void;
    onMouseMove?: (event: MouseEvent | React.MouseEvent) => void;
    onMouseUp?: (event: MouseEvent | React.MouseEvent) => void;
    onMouseDown?: (event: MouseEvent | React.MouseEvent) => void;

    onClick?: (event: MouseEvent | React.MouseEvent) => void;
    onClickWorldPos?: (worldPos: Vec2) => void;
    onClickTilePos?: (tilePos: TilePos) => void;

    onDoubleClick?: (event: MouseEvent | React.MouseEvent) => void;
    onContextMenu?: (event: React.MouseEvent) => void;

    onTileEnter?: (tilePos: TilePos) => void;
    onTileLeave?: (tilePos: TilePos) => void;
}
