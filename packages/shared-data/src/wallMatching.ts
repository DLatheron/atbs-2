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

const CARDINAL_ORIENTATIONS = [
    Orientation.NORTH,
    Orientation.EAST,
    Orientation.SOUTH,
    Orientation.WEST
] as const;

/** N, E, S, W — true when that side of the tile should have a wall edge. */
export type WallEdgeMask = [boolean, boolean, boolean, boolean];

export interface WallFamilyMember {
    id: string;
    edges: WallEdgeTuple;
}

export function wallFamilyId(edges: WallEdgeTuple): string {
    return [...new Set(edges.filter((edge): edge is string => edge !== null))].sort().join("|");
}

export function wallsInFamily<T extends WallFamilyMember>(walls: T[], wallId: string): T[] {
    const seed = walls.find((wall) => wall.id === wallId);
    if (!seed) {
        return walls;
    }

    const family = wallFamilyId(seed.edges);
    return walls.filter((wall) => wallFamilyId(wall.edges) === family);
}

export function groupWallsByFamily<T extends WallFamilyMember>(walls: T[]): T[][] {
    const groups: T[][] = [];
    const indexByFamilyId = new Map<string, number>();

    for (const wall of walls) {
        const family = wallFamilyId(wall.edges);
        const existingIndex = indexByFamilyId.get(family);
        if (existingIndex === undefined) {
            indexByFamilyId.set(family, groups.length);
            groups.push([wall]);
        } else {
            groups[existingIndex].push(wall);
        }
    }

    return groups;
}

export function familyEdgeIds(walls: WallFamilyMember[]): Set<string> {
    const ids = new Set<string>();
    for (const wall of walls) {
        for (const edge of wall.edges) {
            if (edge) {
                ids.add(edge);
            }
        }
    }
    return ids;
}

export function surroundingEdgesForFamily(
    surroundingEdges: SurroundingWallEdges,
    edgeIds: Set<string>
): SurroundingWallEdges {
    const keep = (edge: string | null) => (edge && edgeIds.has(edge) ? edge : null);

    return {
        [Orientation.NORTH]: keep(surroundingEdges[Orientation.NORTH]),
        [Orientation.EAST]: keep(surroundingEdges[Orientation.EAST]),
        [Orientation.SOUTH]: keep(surroundingEdges[Orientation.SOUTH]),
        [Orientation.WEST]: keep(surroundingEdges[Orientation.WEST])
    };
}

export function isStraightWall(edges: WallEdgeTuple): boolean {
    return (
        countWallEdges(edges) === 2 &&
        ((edges[0] !== null && edges[2] !== null) || (edges[1] !== null && edges[3] !== null))
    );
}

export function orientationForVerticalStraight(edges: WallEdgeTuple): Orientation {
    for (const orientation of CARDINAL_ORIENTATIONS) {
        const rotated = rotateWallEdges(edges, orientation);
        if (rotated[0] && rotated[2] && !rotated[1] && !rotated[3]) {
            return orientation;
        }
    }

    return Orientation.NORTH;
}

export function matchWallPieceInFamily(params: {
    surroundingEdges: SurroundingWallEdges;
    walls: WallFamilyMember[];
    preferredWallId: string;
    preferredDirection?: Orientation;
    fallback?: { id: string; orientation: Orientation };
}): { id: string; orientation: Orientation } | undefined {
    const family = wallsInFamily(params.walls, params.preferredWallId);

    return matchWallPiece({
        surroundingEdges: surroundingEdgesForFamily(params.surroundingEdges, familyEdgeIds(family)),
        walls: family,
        preferredDirection: params.preferredDirection,
        fallback: params.fallback
    });
}

/**
 * 3x3 layout matching hotkeys r t y / f g h / v b n.
 * Cardinal cells prefer a T-junction, then a straight; corners and the centre
 * are the matching corner/cross piece of the current wall family.
 */
export const WALL_GRID_LAYOUT: {
    row: number;
    col: number;
    key: string;
    masks: WallEdgeMask[];
}[] = [
    { row: 0, col: 0, key: "r", masks: [[false, true, true, false]] },
    {
        row: 0,
        col: 1,
        key: "t",
        masks: [
            [false, true, true, true],
            [false, true, false, true]
        ]
    },
    { row: 0, col: 2, key: "y", masks: [[true, true, false, false]] },
    {
        row: 1,
        col: 0,
        key: "f",
        masks: [
            [true, true, true, false],
            [true, false, true, false]
        ]
    },
    { row: 1, col: 1, key: "g", masks: [[true, true, true, true]] },
    {
        row: 1,
        col: 2,
        key: "h",
        masks: [
            [true, false, true, true],
            [true, false, true, false]
        ]
    },
    { row: 2, col: 0, key: "v", masks: [[false, false, true, true]] },
    {
        row: 2,
        col: 1,
        key: "b",
        masks: [
            [true, true, false, true],
            [false, true, false, true]
        ]
    },
    { row: 2, col: 2, key: "n", masks: [[true, false, false, true]] }
];

export interface WallGridOption {
    id: string;
    orientation: Orientation;
}

export interface WallGridCell {
    row: number;
    col: number;
    key: string;
    options: WallGridOption[];
}

function edgesMatchMask(edges: WallEdgeTuple, mask: WallEdgeMask): boolean {
    return (
        (edges[0] !== null) === mask[0] &&
        (edges[1] !== null) === mask[1] &&
        (edges[2] !== null) === mask[2] &&
        (edges[3] !== null) === mask[3]
    );
}

function findWallForMask(
    walls: WallFamilyMember[],
    mask: WallEdgeMask,
    usedIds: Set<string>
): WallGridOption | undefined {
    for (const wall of walls) {
        if (usedIds.has(wall.id)) {
            continue;
        }

        for (const orientation of CARDINAL_ORIENTATIONS) {
            if (edgesMatchMask(rotateWallEdges(wall.edges, orientation), mask)) {
                return { id: wall.id, orientation };
            }
        }
    }

    return undefined;
}

export function getWallGrid(walls: WallFamilyMember[]): WallGridCell[] {
    return WALL_GRID_LAYOUT.map(({ row, col, key, masks }) => {
        const options: WallGridOption[] = [];
        const usedIds = new Set<string>();

        for (const mask of masks) {
            const match = findWallForMask(walls, mask, usedIds);
            if (match) {
                options.push(match);
                usedIds.add(match.id);
            }
        }

        return { row, col, key, options };
    });
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
