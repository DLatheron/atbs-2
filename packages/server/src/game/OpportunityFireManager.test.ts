import { beforeEach, describe, expect, it, vi } from "vitest";
import { TilePos } from "@atbs/maths";
import { OpportunityFireManager } from "./OpportunityFireManager.js";
import type { Game } from "./Game.js";
import type { Unit } from "./Unit.js";

describe("OpportunityFireManager visibility", () => {
    const send = vi.fn();
    const broadcast = vi.fn();
    const resumeMessageSending = vi.fn();
    const pauseMessageSending = vi.fn();
    const getVisibilityUpdate = vi.fn().mockReturnValue({
        tiles: ["[1, 1]"],
        viewers: [
            {
                location: { col: 3, row: 3 },
                orientation: 0,
                viewAngleInDegrees: 90,
                viewRange: 1000
            }
        ]
    });

    const enemyTileUpdate = {
        tilePos: { col: 1, row: 1 },
        tileByRenderMode: {
            MAP_MODE: [{ imageId: "enemy-body", visibilityFilter: ["visible"] }],
            FIRE_MODE: [{ imageId: "enemy-body", visibilityFilter: ["visible"] }]
        }
    };

    const getVisibleOppositionTileUpdates = vi.fn().mockReturnValue([enemyTileUpdate]);

    let ofUnit: Unit;
    let movingUnit: Unit;
    let game: Game;
    let manager: OpportunityFireManager;

    beforeEach(() => {
        send.mockClear();
        broadcast.mockClear();
        resumeMessageSending.mockClear();
        pauseMessageSending.mockClear();
        getVisibilityUpdate.mockClear();
        getVisibleOppositionTileUpdates.mockClear();

        movingUnit = {
            id: "mover",
            name: "Mover",
            isAlive: true,
            location: new TilePos(1, 1),
            mapLocation: new TilePos(1, 1),
            side: { id: "attackers", oppositionSideIds: ["defenders"] }
        } as unknown as Unit;

        ofUnit = {
            id: "of-unit",
            name: "OF Shooter",
            canOpportunityFire: true,
            canSee: [movingUnit],
            mapLocation: new TilePos(3, 3),
            itemInUse: { getFireModeItemSummary: () => ({ id: "gun" }) },
            toSummary: () => ({ id: "of-unit", name: "OF Shooter", canSee: 1 }),
            side: { id: "defenders", oppositionSideIds: ["attackers"] }
        } as unknown as Unit;

        const attackersCanSee = vi.fn().mockReturnValue(false);
        const defendersCanSee = vi.fn().mockReturnValue(true);

        game = {
            turnsSideId: "attackers",
            getSide: (sideId: string) =>
                sideId === "attackers"
                    ? { id: "attackers", canSee: attackersCanSee }
                    : { id: "defenders", canSee: defendersCanSee },
            getVisibleOppositionTileUpdates,
            map: {
                getTile: (pos: TilePos) => ({
                    location: pos,
                    generateTileUpdate: () =>
                        TilePos.IsEqual(pos, movingUnit.mapLocation)
                            ? enemyTileUpdate
                            : {
                                  tilePos: { col: pos.col, row: pos.row },
                                  tileByRenderMode: { MAP_MODE: [], FIRE_MODE: [] }
                              }
                })
            },
            visibilityManager: { getVisibilityUpdate },
            messageRouter: {
                send,
                broadcast,
                resumeMessageSending,
                pauseMessageSending
            }
        } as unknown as Game;

        manager = new OpportunityFireManager(game);
    });

    function defenderMessages() {
        return send.mock.calls
            .filter(([, sideId]) => sideId === "defenders")
            .flatMap(([message]) => (Array.isArray(message) ? message : [message]));
    }

    function assertVisibleTilesThenEnemySprite(messages: { type: string; payload?: unknown }[]) {
        const visibleIdx = messages.findIndex((m) => m.type === "server:visible:tiles");
        const mapIdx = messages.findIndex((m) => m.type === "server:map:update");

        expect(visibleIdx).toBeGreaterThanOrEqual(0);
        expect(mapIdx).toBeGreaterThan(visibleIdx);

        const visibleTiles = messages[visibleIdx];
        expect(visibleTiles.payload).toEqual(
            expect.objectContaining({ tiles: expect.arrayContaining(["[1, 1]"]) })
        );

        const mapUpdate = messages[mapIdx];
        expect(mapUpdate.payload).toEqual([enemyTileUpdate]);
        const renderImages = (mapUpdate.payload as (typeof enemyTileUpdate)[])[0].tileByRenderMode
            .MAP_MODE;
        expect(renderImages.some((img) => img.imageId === "enemy-body")).toBe(true);

        expect(getVisibleOppositionTileUpdates).toHaveBeenCalledWith("defenders");
        expect(getVisibilityUpdate).toHaveBeenCalledWith(["attackers"]);
    }

    it("sends visible:tiles then map:update with enemy sprite when OF starts for the other side", () => {
        manager.registerOpportunity(ofUnit, 10);

        expect(manager.startOpportunityFire()).toBe(true);

        expect(resumeMessageSending).toHaveBeenCalledWith("defenders");
        assertVisibleTilesThenEnemySprite(defenderMessages());
    });

    it("sends visible:tiles then map:update with enemy sprite for same-side OF", () => {
        game.turnsSideId = "defenders";
        manager.registerOpportunity(ofUnit, 10);

        expect(manager.startOpportunityFire()).toBe(true);

        expect(resumeMessageSending).not.toHaveBeenCalled();
        assertVisibleTilesThenEnemySprite(defenderMessages());
    });

    it("uses the current side canSee for OF camera to the playing side", () => {
        manager.registerOpportunity(ofUnit, 10);
        manager.startOpportunityFire();

        const attackerMessages = send.mock.calls
            .filter(([, sideId]) => sideId === "attackers")
            .flatMap(([message]) => (Array.isArray(message) ? message : [message]));
        const cameraMoves = attackerMessages.filter(
            (message) => message.type === "server:camera:move:to"
        );
        // attackers.canSee(OF tile) is false — no camera snap to hidden OF unit
        expect(cameraMoves).toEqual([]);
    });
});
