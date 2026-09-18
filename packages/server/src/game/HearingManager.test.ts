import { describe, expect, it, vi } from "vitest";
import { OnTarget, TrackingSpeed } from "@atbs/shared-data";
import { Aabb, TilePos, Vec2 } from "@atbs/maths";
import {
    approximateHearingPosition,
    castAudioRay,
    HearingManager,
    MAX_HEARING_ERROR,
    seededUnitRandom
} from "./HearingManager.js";
import { broadcastFilteredFireTrace } from "./fireTraceBroadcast.js";
import type { Game } from "./Game.js";
import type { Side } from "./Side.js";
import type { WorldMap } from "./WorldMap.js";
import type { Tile } from "./Tile.js";
import type { Unit } from "./Unit.js";

function makeEmptyMap(widthTiles: number, heightTiles: number, tileSize = 100): WorldMap {
    const makeTile = (col: number, row: number): Tile =>
        ({
            location: new TilePos(col, row),
            anythingCollidable: false,
            getCollisionLayers: () => []
        }) as unknown as Tile;

    const tiles: Tile[][] = Array.from({ length: heightTiles }, (_, row) =>
        Array.from({ length: widthTiles }, (_, col) => makeTile(col, row))
    );

    return {
        tileSize,
        worldBounds: new Aabb(0, 0, widthTiles * tileSize, heightTiles * tileSize),
        worldToTile: (pos: Vec2) =>
            new TilePos(Math.floor(pos.x / tileSize), Math.floor(pos.y / tileSize)),
        sampleTile: (pos: TilePos) => tiles[pos.row]?.[pos.col]
    } as unknown as WorldMap;
}

describe("HearingManager helpers", () => {
    it("seededUnitRandom is deterministic for the same seed", () => {
        const a = seededUnitRandom("game:1:0");
        const b = seededUnitRandom("game:1:0");
        expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    });

    it("approximateHearingPosition error grows with distance fraction", () => {
        const near = approximateHearingPosition(
            { x: 0, y: 0 },
            1000,
            10000,
            seededUnitRandom("near"),
            MAX_HEARING_ERROR
        );
        const far = approximateHearingPosition(
            { x: 0, y: 0 },
            10000,
            10000,
            seededUnitRandom("far"),
            MAX_HEARING_ERROR
        );
        const nearErr = Math.hypot(near.x, near.y);
        const farErr = Math.hypot(far.x, far.y);
        expect(nearErr).toBeLessThan(MAX_HEARING_ERROR * 0.05 + 1);
        expect(farErr).toBeGreaterThan(nearErr);
        expect(farErr).toBeLessThanOrEqual(MAX_HEARING_ERROR + 1e-6);
    });

    it("castAudioRay hears open-air within maxDistance and cuts off beyond", () => {
        const map = makeEmptyMap(20, 20);
        const src = new Vec2(50, 50);
        const near = new Vec2(50, 50 + 500);
        const far = new Vec2(50, 50 + 2000);

        expect(
            castAudioRay(map, src, near, 1000, {
                skipTilePos: new TilePos(0, 0),
                targetTilePos: new TilePos(0, 5)
            }).heard
        ).toBe(true);

        expect(
            castAudioRay(map, src, far, 1000, {
                skipTilePos: new TilePos(0, 0),
                targetTilePos: new TilePos(0, 20)
            }).heard
        ).toBe(false);
    });

    it("castAudioRay remaining life drains by open-air distance", () => {
        const map = makeEmptyMap(10, 10);
        const result = castAudioRay(map, new Vec2(50, 50), new Vec2(50, 550), 1000, {
            skipTilePos: new TilePos(0, 0),
            targetTilePos: new TilePos(0, 5)
        });
        expect(result.heard).toBe(true);
        expect(result.remainingLife).toBeCloseTo(500, 0);
    });
});

describe("broadcastFilteredFireTrace", () => {
    function makeGame(options: {
        visible: Record<string, boolean>;
        send: ReturnType<typeof vi.fn>;
        emitNoise: ReturnType<typeof vi.fn>;
    }): Game {
        const tiles = new Map<string, Tile>();
        const getTile = (pos: TilePos) => {
            const key = `${pos.col},${pos.row}`;
            if (!tiles.has(key)) {
                tiles.set(key, { location: pos } as Tile);
            }
            return tiles.get(key)!;
        };

        const sides = [{ id: "attackers" }, { id: "defenders" }] as Side[];

        return {
            sides,
            getSide: (sideId: string) => ({
                id: sideId,
                canSee: (tile: Tile) =>
                    options.visible[`${sideId}:${tile.location.col},${tile.location.row}`] === true
            }),
            map: {
                sampleTile: (pos: TilePos) => getTile(pos),
                worldToTile: (pos: Vec2) =>
                    new TilePos(Math.floor(pos.x / 100), Math.floor(pos.y / 100)),
                tileCenterToWorld: (pos: TilePos) =>
                    new Vec2(pos.col * 100 + 50, pos.row * 100 + 50)
            },
            messageRouter: { send: options.send },
            hearingManager: { emitNoise: options.emitNoise }
        } as unknown as Game;
    }

    it("always delivers full fire:trace to the acting side", () => {
        const send = vi.fn();
        const emitNoise = vi.fn();
        const game = makeGame({ visible: {}, send, emitNoise });

        broadcastFilteredFireTrace({
            game,
            payload: {
                tracers: [],
                isOnTarget: OnTarget.enum.none,
                tileUpdates: [],
                deaths: [],
                hitSparks: [],
                animations: [],
                animObjects: [],
                animObjectRemovals: []
            },
            actingSideId: "attackers",
            originWorldPos: new Vec2(50, 50),
            originTilePos: new TilePos(0, 0),
            noise: 100
        });

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({ type: "server:fire:trace" }),
            "attackers"
        );
        expect(send.mock.calls.every(([, sideId]) => sideId !== "defenders")).toBe(true);
        expect(emitNoise).toHaveBeenCalledWith(
            expect.objectContaining({ noise: 100, actingSideId: "attackers" })
        );
    });

    it("does not send fire:trace to hear-only / deaf sides", () => {
        const send = vi.fn();
        const emitNoise = vi.fn();
        const game = makeGame({
            visible: { "defenders:5,5": true },
            send,
            emitNoise
        });

        broadcastFilteredFireTrace({
            game,
            payload: {
                tracers: [
                    {
                        segments: [
                            { pos: { x: 50, y: 50 }, time: 0 },
                            { pos: { x: 150, y: 50 }, time: 10 }
                        ],
                        headColour: { r: 1, g: 1, b: 1, a: 1 },
                        headRadiusInPixels: 2,
                        trailColour: { r: 1, g: 1, b: 1, a: 1 },
                        trailLengthInMs: 100,
                        maxRangeInMs: 200,
                        rangeFalloffPower: 1
                    }
                ],
                isOnTarget: OnTarget.enum.none,
                tileUpdates: [],
                deaths: [],
                hitSparks: [],
                animations: [],
                animObjects: [],
                animObjectRemovals: []
            },
            actingSideId: "attackers",
            originWorldPos: new Vec2(50, 50),
            originTilePos: new TilePos(0, 0),
            noise: 100,
            deferHearing: true
        });

        const defenderSends = send.mock.calls.filter(([, sideId]) => sideId === "defenders");
        expect(defenderSends).toHaveLength(0);
    });

    it("sends filtered fire:trace when the side can see the origin", () => {
        const send = vi.fn();
        const emitNoise = vi.fn();
        const game = makeGame({
            visible: { "defenders:0,0": true },
            send,
            emitNoise
        });

        broadcastFilteredFireTrace({
            game,
            payload: {
                tracers: [],
                isOnTarget: OnTarget.enum.onTarget,
                tileUpdates: [],
                deaths: [],
                hitSparks: [],
                animations: [],
                animObjects: [],
                animObjectRemovals: []
            },
            actingSideId: "attackers",
            originWorldPos: new Vec2(50, 50),
            originTilePos: new TilePos(0, 0),
            deferHearing: true
        });

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({ type: "server:fire:trace" }),
            "defenders"
        );
    });

    it("always delivers structural damaged-tile updates even when canSee is false", () => {
        const send = vi.fn();
        const emitNoise = vi.fn();
        const game = makeGame({ visible: {}, send, emitNoise });

        const damagedTileUpdate = {
            timeMs: 10,
            tilePos: { col: 5, row: 5 },
            tileByRenderMode: {
                MAP_MODE: [
                    { imageId: "wall-damaged" },
                    {
                        imageId: "enemy-sprite",
                        visibilityFilter: ["visible" as const]
                    }
                ],
                FIRE_MODE: [{ imageId: "wall-damaged" }]
            }
        };

        broadcastFilteredFireTrace({
            game,
            payload: {
                tracers: [],
                isOnTarget: OnTarget.enum.none,
                tileUpdates: [damagedTileUpdate],
                deaths: [],
                hitSparks: [],
                animations: [],
                animObjects: [],
                animObjectRemovals: []
            },
            actingSideId: "attackers",
            originWorldPos: new Vec2(50, 50),
            originTilePos: new TilePos(0, 0),
            deferHearing: true
        });

        const defenderTrace = send.mock.calls.find(
            ([message, sideId]) => sideId === "defenders" && message.type === "server:fire:trace"
        );
        expect(defenderTrace).toBeDefined();
        const payload = defenderTrace![0].payload;
        expect(payload.tileUpdates).toHaveLength(1);
        expect(payload.tileUpdates[0].tileByRenderMode.MAP_MODE).toEqual([
            { imageId: "wall-damaged" }
        ]);
        expect(payload.tracers).toEqual([]);
    });

    it("delivers gas/smoke animObjects by VFX tile, not firer visibility", () => {
        const send = vi.fn();
        const emitNoise = vi.fn();
        // Can see the cloud at (5,5) but not the firer at (0,0).
        const game = makeGame({
            visible: { "defenders:5,5": true },
            send,
            emitNoise
        });

        const gasTileUpdate = {
            timeMs: 10,
            tilePos: { col: 5, row: 5 },
            tileByRenderMode: {
                MAP_MODE: [
                    {
                        imageId: "anim-gas.vfx-1",
                        visibilityFilter: ["visible" as const]
                    }
                ],
                FIRE_MODE: [
                    {
                        imageId: "anim-gas.vfx-1",
                        visibilityFilter: ["visible" as const]
                    }
                ]
            }
        };

        broadcastFilteredFireTrace({
            game,
            payload: {
                tracers: [],
                isOnTarget: OnTarget.enum.none,
                tileUpdates: [gasTileUpdate],
                deaths: [],
                hitSparks: [],
                animations: [],
                animObjects: [
                    {
                        recipe: {
                            instanceId: "anim-gas.vfx-1",
                            recipes: []
                        },
                        startTimeMs: 10
                    }
                ],
                animObjectRemovals: []
            },
            actingSideId: "attackers",
            originWorldPos: new Vec2(50, 50),
            originTilePos: new TilePos(0, 0),
            deferHearing: true
        });

        const defenderTrace = send.mock.calls.find(
            ([message, sideId]) => sideId === "defenders" && message.type === "server:fire:trace"
        );
        expect(defenderTrace).toBeDefined();
        const payload = defenderTrace![0].payload;
        expect(payload.animObjects).toHaveLength(1);
        expect(payload.animObjects[0].recipe.instanceId).toBe("anim-gas.vfx-1");
        expect(payload.tileUpdates[0].tileByRenderMode.MAP_MODE).toEqual([
            {
                imageId: "anim-gas.vfx-1",
                visibilityFilter: ["visible"]
            }
        ]);
    });

    it("does not deliver gas animObjects for tiles the side cannot see", () => {
        const send = vi.fn();
        const emitNoise = vi.fn();
        const game = makeGame({
            visible: { "defenders:0,0": true },
            send,
            emitNoise
        });

        const gasTileUpdate = {
            timeMs: 10,
            tilePos: { col: 5, row: 5 },
            tileByRenderMode: {
                MAP_MODE: [
                    {
                        imageId: "anim-gas.vfx-1",
                        visibilityFilter: ["visible" as const]
                    }
                ],
                FIRE_MODE: [
                    {
                        imageId: "anim-gas.vfx-1",
                        visibilityFilter: ["visible" as const]
                    }
                ]
            }
        };

        broadcastFilteredFireTrace({
            game,
            payload: {
                tracers: [],
                isOnTarget: OnTarget.enum.none,
                tileUpdates: [gasTileUpdate],
                deaths: [],
                hitSparks: [],
                animations: [],
                animObjects: [
                    {
                        recipe: {
                            instanceId: "anim-gas.vfx-1",
                            recipes: []
                        },
                        startTimeMs: 10
                    }
                ],
                animObjectRemovals: [{ instanceId: "anim-gas.vfx-0", startTimeMs: 0 }]
            },
            actingSideId: "attackers",
            originWorldPos: new Vec2(50, 50),
            originTilePos: new TilePos(0, 0),
            deferHearing: true
        });

        const defenderTrace = send.mock.calls.find(
            ([message, sideId]) => sideId === "defenders" && message.type === "server:fire:trace"
        );
        expect(defenderTrace).toBeDefined();
        const payload = defenderTrace![0].payload;
        expect(payload.animObjects).toEqual([]);
        // Removals still attach for cleanup even when the cloud tile is unseen.
        expect(payload.animObjectRemovals).toEqual([
            { instanceId: "anim-gas.vfx-0", startTimeMs: 0 }
        ]);
        // Unseen cloud tile is structural-only (VFX placeholder stripped).
        expect(payload.tileUpdates[0].tileByRenderMode.MAP_MODE).toEqual([]);
    });

    it("delivers shockwave animations by effect worldPos, not firer", () => {
        const send = vi.fn();
        const emitNoise = vi.fn();
        const game = makeGame({
            visible: { "defenders:5,5": true },
            send,
            emitNoise
        });

        broadcastFilteredFireTrace({
            game,
            payload: {
                tracers: [],
                isOnTarget: OnTarget.enum.none,
                tileUpdates: [],
                deaths: [],
                hitSparks: [],
                animations: [
                    {
                        playAnimation: {
                            instanceId: "shockwave-1",
                            offset: 0,
                            recipe: { id: "shockwave", stateDef: {} },
                            worldPos: { x: 550, y: 550 }
                        },
                        startTimeMs: 0
                    }
                ],
                animObjects: [],
                animObjectRemovals: []
            },
            actingSideId: "attackers",
            originWorldPos: new Vec2(50, 50),
            originTilePos: new TilePos(0, 0),
            deferHearing: true
        });

        const defenderTrace = send.mock.calls.find(
            ([message, sideId]) => sideId === "defenders" && message.type === "server:fire:trace"
        );
        expect(defenderTrace).toBeDefined();
        expect(defenderTrace![0].payload.animations).toHaveLength(1);
    });

    it("delivers hitSparks by spark position when firer is unseen", () => {
        const send = vi.fn();
        const emitNoise = vi.fn();
        const game = makeGame({
            visible: { "defenders:5,5": true },
            send,
            emitNoise
        });

        broadcastFilteredFireTrace({
            game,
            payload: {
                tracers: [],
                isOnTarget: OnTarget.enum.none,
                tileUpdates: [],
                deaths: [],
                hitSparks: [
                    {
                        pos: { x: 550, y: 550 },
                        timeMs: 5,
                        colour: { r: 1, g: 1, b: 1, a: 1 },
                        direction: { x: 1, y: 0 },
                        count: 3
                    }
                ],
                animations: [],
                animObjects: [],
                animObjectRemovals: []
            },
            actingSideId: "attackers",
            originWorldPos: new Vec2(50, 50),
            originTilePos: new TilePos(0, 0),
            deferHearing: true
        });

        const defenderTrace = send.mock.calls.find(
            ([message, sideId]) => sideId === "defenders" && message.type === "server:fire:trace"
        );
        expect(defenderTrace).toBeDefined();
        expect(defenderTrace![0].payload.hitSparks).toHaveLength(1);
    });
});

describe("emitNoise vision precedence", () => {
    it("skips hearing cue when the side can see the origin tile", () => {
        const send = vi.fn();
        const sideCanSee = vi.fn().mockReturnValue(true);

        const game = {
            id: "TEST-GAME",
            turn: 1,
            sides: [{ id: "attackers" }, { id: "defenders" }],
            getSide: () => ({
                id: "defenders",
                canSee: sideCanSee,
                units: []
            }),
            map: {
                worldToTile: () => new TilePos(0, 0),
                sampleTile: () => ({ location: new TilePos(0, 0) }),
                tileCenterToWorld: () => new Vec2(50, 50)
            },
            messageRouter: { send }
        } as unknown as Game;

        const manager = new HearingManager(game);
        manager.emitNoise({
            worldPos: new Vec2(50, 50),
            noise: 100,
            actingSideId: "attackers"
        });

        expect(send).not.toHaveBeenCalled();
        expect(sideCanSee).toHaveBeenCalled();
    });

    it("sends VERY_FAST world camera cue when hear-only", () => {
        const send = vi.fn();
        const hearer = {
            isDead: false,
            hearingRange: 10000,
            mapLocation: new TilePos(0, 0)
        } as Unit;

        const game = {
            id: "TEST-GAME",
            turn: 1,
            sides: [{ id: "attackers" }, { id: "defenders" }],
            getSide: (sideId: string) => ({
                id: sideId,
                canSee: () => false,
                units: sideId === "defenders" ? [hearer] : []
            }),
            map: makeEmptyMap(10, 10),
            messageRouter: { send }
        } as unknown as Game;

        const manager = new HearingManager(game);
        vi.spyOn(manager, "sampleHearing").mockReturnValue({
            unit: hearer,
            remainingLife: 500,
            distance: 500,
            maxDistance: 10000
        });

        manager.emitNoise({
            worldPos: new Vec2(500, 500),
            noise: 100,
            actingSideId: "attackers"
        });

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "server:camera:move:to",
                payload: expect.objectContaining({
                    target: "world",
                    trackingSpeed: TrackingSpeed.enum.VERY_FAST
                })
            }),
            "defenders"
        );
    });
});
