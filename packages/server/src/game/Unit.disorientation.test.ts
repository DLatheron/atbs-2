import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenderMode } from "@atbs/shared-data";
import { Orientation } from "@atbs/maths";
import type { Game } from "./Game.js";
import { ItemManager } from "./ItemManager.js";
import { ItemRecipeManager } from "./ItemRecipeManager.js";
import { MaterialManager } from "./MaterialManager.js";
import { MaterialRecipe } from "./Material.js";
import type { Side } from "./Side.js";
import { Unit, UnitRecipe } from "./Unit.js";
import { DISORIENTATION_FADE_MS, unitDisorientAnimId } from "../AnimationDefinitions.js";

function ensureHumanMaterial(): void {
    const materials = MaterialManager.GetSingleton();
    if (materials.hasMaterial("human.material")) {
        return;
    }

    materials.addMaterial(
        MaterialRecipe.parse({
            id: "human.material",
            category: "unit",
            rgb: { r: 248, g: 238, b: 0 },
            densityMap: { default: 3, eyeball: 100 },
            hardness: 0.15,
            toughness: 0.25,
            roughness: 0,
            elasticity: 0,
            density: 0.2
        })
    );
}

function testUnitRecipe(): UnitRecipe {
    return UnitRecipe.parse({
        id: "unit-1",
        name: "Test Unit",
        description: [{ text: "Test" }],
        attributes: {
            weight: 80,
            actionPoints: { max: 40 },
            constitution: { max: 50 },
            fitness: { max: 50 },
            morale: { max: 50 },
            stamina: { max: 50 },
            speed: { max: 50 },
            strength: { max: 50 }
        },
        inventory: { inUse: null, items: [] },
        collision: {
            shape: "circle",
            radius: 24,
            materials: ["human.material"]
        },
        renderable: {
            UI_MODE: {
                alive: { default: [{ imageId: "generic-4" }] },
                default: []
            },
            MAP_MODE: {
                alive: { default: [{ imageId: "generic-0" }] },
                default: []
            },
            FIRE_MODE: {
                default: [{ imageId: "generic-cl" }]
            },
            default: []
        },
        actions: {}
    });
}

function overlayIds(renderList: { imageId: string }[]): string[] {
    return renderList
        .filter(({ imageId }) => imageId.startsWith("anim-disorient-"))
        .map(({ imageId }) => imageId);
}

describe("Unit disorientation overlay", () => {
    const sentMessages: unknown[] = [];
    let unit: Unit;

    beforeEach(() => {
        sentMessages.length = 0;
        ensureHumanMaterial();

        const game = {
            itemManager: new ItemManager(new ItemRecipeManager()),
            visibilityManager: {
                addViewer: vi.fn(),
                invalidateViewerLocation: vi.fn(),
                invalidateViewerOrientation: vi.fn()
            },
            broadcastMessage: (message: unknown) => {
                sentMessages.push(message);
            },
            map: {
                tileSize: 100,
                getTile: () => ({
                    generateTileUpdate: () => ({ tilePos: { row: 0, col: 0 } })
                })
            },
            messageRouter: {
                sendIfVisible: (message: unknown) => {
                    sentMessages.push(message);
                },
                send: vi.fn()
            }
        } as unknown as Game;

        unit = new Unit(
            testUnitRecipe(),
            { orientation: Orientation.NORTH },
            { side: { id: "side-1" } as Side },
            game
        );
    });

    afterEach(() => {
        vi.useRealTimers();
        while (Unit.disorientationVisualsDeferred) {
            Unit.endDeferredDisorientationVisuals();
        }
    });

    it("omits overlay images when disorientation is 0", () => {
        const renderList = unit.getRenderList({
            renderMode: RenderMode.enum.MAP_MODE,
            states: []
        });

        expect(overlayIds(renderList)).toStrictEqual([]);
        expect(renderList.some(({ imageId }) => imageId === "generic-0")).toBe(true);
    });

    it("appends one anim placeholder per star in MAP_MODE", () => {
        unit.disorientation = 18;

        const renderList = unit.getRenderList({
            renderMode: RenderMode.enum.MAP_MODE,
            states: []
        });

        expect(overlayIds(renderList)).toStrictEqual([unitDisorientAnimId("unit-1", 0)]);
    });

    it("appends four anim placeholders at 86 disorientation in MAP_MODE and FIRE_MODE", () => {
        unit.disorientation = 86;

        const expected = [
            unitDisorientAnimId("unit-1", 0),
            unitDisorientAnimId("unit-1", 1),
            unitDisorientAnimId("unit-1", 2),
            unitDisorientAnimId("unit-1", 3)
        ];

        expect(
            overlayIds(
                unit.getRenderList({
                    renderMode: RenderMode.enum.MAP_MODE,
                    states: []
                })
            )
        ).toStrictEqual(expected);
        expect(
            overlayIds(
                unit.getRenderList({
                    renderMode: RenderMode.enum.FIRE_MODE,
                    states: []
                })
            )
        ).toStrictEqual(expected);
    });

    it("does not append overlay images in UI_MODE", () => {
        unit.disorientation = 86;

        const uiList = unit.getRenderList({
            renderMode: RenderMode.enum.UI_MODE,
            states: []
        });

        expect(overlayIds(uiList)).toStrictEqual([]);
        expect(uiList.some(({ imageId }) => imageId === "generic-4")).toBe(true);
    });

    it("broadcasts looping play animations when disorientation appears", () => {
        unit.disorientation = 18;

        expect(sentMessages).toHaveLength(1);
        expect(sentMessages[0]).toMatchObject({
            type: "server:animations:play",
            payload: [
                {
                    instanceId: unitDisorientAnimId("unit-1", 0),
                    recipe: { flags: { loop: true } }
                }
            ]
        });
    });

    it("keeps placeholders while fading then strips them after the fade duration", () => {
        vi.useFakeTimers();
        unit.disorientation = 18;
        sentMessages.length = 0;

        unit.disorientation = 0;

        expect(
            overlayIds(unit.getRenderList({ renderMode: RenderMode.enum.MAP_MODE, states: [] }))
        ).toHaveLength(1);
        expect(sentMessages[0]).toMatchObject({
            type: "server:animations:play",
            payload: [{ recipe: { id: "disorientation-orbit-fade" } }]
        });

        vi.advanceTimersByTime(DISORIENTATION_FADE_MS);

        expect(
            overlayIds(unit.getRenderList({ renderMode: RenderMode.enum.MAP_MODE, states: [] }))
        ).toStrictEqual([]);
    });

    it("does not broadcast orbit animations while fire-trace visuals are deferred", () => {
        Unit.beginDeferredDisorientationVisuals();
        unit.disorientation = 18;
        unit.noteDeferredDisorientationHit(240);

        expect(sentMessages).toHaveLength(0);
        expect(
            overlayIds(unit.getRenderList({ renderMode: RenderMode.enum.MAP_MODE, states: [] }))
        ).toStrictEqual([unitDisorientAnimId("unit-1", 0)]);

        Unit.endDeferredDisorientationVisuals();

        const deferred = unit.takeDeferredDisorientationVisual();
        expect(deferred).toMatchObject({
            timeMs: 240,
            playAnimations: [{ instanceId: unitDisorientAnimId("unit-1", 0) }]
        });
        expect(sentMessages).toHaveLength(0);
    });
});
