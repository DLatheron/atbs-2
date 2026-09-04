import { Orientation, rotateOrientation, wrap } from "@atbs/maths";
import { WallEdgeTuple } from "./types/EditorTypes.js";

export type SurroundingWallEdges = {
    [Orientation.NORTH]: string | null;
    [Orientation.EAST]: string | null;
    [Orientation.SOUTH]: string | null;
    [Orientation.WEST]: string | null;
};

export function rotateWallEdges(edges: WallEdgeTuple, orientation: Orientation): WallEdgeTuple {
    const index = orientation / 2;

    return [
        edges[wrap(0 - index, 0, 4)],
        edges[wrap(1 - index, 0, 4)],
        edges[wrap(2 - index, 0, 4)],
        edges[wrap(3 - index, 0, 4)]
    ];
}

export function countWallEdges(edges: readonly (string | null)[]): number {
    return edges.reduce((count, edge) => count + (edge === null ? 0 : 1), 0);
}

export interface WallMatchCandidate {
    id: string;
    orientation: Orientation;
    score: number;
    edgeCount: number;
    paletteIndex: number;
}

export function matchWallPiece(params: {
    surroundingEdges: SurroundingWallEdges;
    walls: { id: string; edges: WallEdgeTuple }[];
    preferredDirection?: Orientation;
    fallback?: { id: string; orientation: Orientation };
}): { id: string; orientation: Orientation } | undefined {
    const { surroundingEdges, walls, preferredDirection, fallback } = params;
    const tileEdgeCount = countWallEdges([
        surroundingEdges[Orientation.NORTH],
        surroundingEdges[Orientation.EAST],
        surroundingEdges[Orientation.SOUTH],
        surroundingEdges[Orientation.WEST]
    ]);

    // With no neighbours, keep the caller's selected piece/orientation so
    // different wall families (e.g. thin concrete vs thick stone) stay intentional.
    if (tileEdgeCount === 0) {
        return fallback;
    }

    const candidates: WallMatchCandidate[] = [];

    for (const [paletteIndex, wall] of walls.entries()) {
        const wallEdgeCount = countWallEdges(wall.edges);
        if (wallEdgeCount < tileEdgeCount) {
            continue;
        }

        for (const tryingOrientation of [
            Orientation.NORTH,
            Orientation.EAST,
            Orientation.SOUTH,
            Orientation.WEST
        ]) {
            const wallEdges = rotateWallEdges(wall.edges, tryingOrientation);
            const matches = [
                surroundingEdges[Orientation.NORTH] === null ||
                    wallEdges[Orientation.NORTH / 2] === surroundingEdges[Orientation.NORTH],
                surroundingEdges[Orientation.EAST] === null ||
                    wallEdges[Orientation.EAST / 2] === surroundingEdges[Orientation.EAST],
                surroundingEdges[Orientation.SOUTH] === null ||
                    wallEdges[Orientation.SOUTH / 2] === surroundingEdges[Orientation.SOUTH],
                surroundingEdges[Orientation.WEST] === null ||
                    wallEdges[Orientation.WEST / 2] === surroundingEdges[Orientation.WEST]
            ];

            if (!matches.every(Boolean)) {
                continue;
            }

            let score = 1;
            if (preferredDirection !== undefined && wallEdges[preferredDirection / 2]) {
                score += 2;
            }

            candidates.push({
                id: wall.id,
                orientation: tryingOrientation,
                score,
                edgeCount: wallEdgeCount,
                paletteIndex
            });
        }
    }

    const idealEdgeCount = Math.max(2, tileEdgeCount);

    candidates.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        const aDistance = Math.abs(a.edgeCount - idealEdgeCount);
        const bDistance = Math.abs(b.edgeCount - idealEdgeCount);
        if (aDistance !== bDistance) {
            return aDistance - bDistance;
        }

        return a.edgeCount - b.edgeCount || a.paletteIndex - b.paletteIndex;
    });

    const best = candidates[0];
    if (best) {
        return { id: best.id, orientation: best.orientation };
    }

    return fallback;
}

export function getAdjacentWallEdge(
    wallEdges: WallEdgeTuple,
    wallOrientation: Orientation,
    fromDirection: Orientation
): string | null {
    const rotatedEdges = rotateWallEdges(wallEdges, wallOrientation);
    return rotatedEdges[rotateOrientation(fromDirection, 4) / 2];
}
