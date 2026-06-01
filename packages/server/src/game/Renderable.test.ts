import { Orientation } from "@atbs/maths";
import { ModeNode, Renderable, RenderableContext } from "./Renderable.js";
import { RenderImage, RenderMode } from "@atbs/shared-data";

describe("Renderable", () => {
    const unitRenderableRecipe = {
        "ui-mode": {
            alive: {
                "item-in-use": [{ imageId: "generic-carrying-4" }],
                default: [{ imageId: "generic-4" }]
            },
            dead: [{ imageId: "generic-dead" }],
            default: []
        },
        "map-mode": {
            alive: {
                default: [
                    [{ imageId: "generic-0", orientation: 8 }],
                    [{ imageId: "generic-1", orientation: 8 }],
                    [{ imageId: "generic-2", orientation: 8 }],
                    [{ imageId: "generic-3", orientation: 8 }],
                    [{ imageId: "generic-4", orientation: 8 }],
                    [{ imageId: "generic-5", orientation: 8 }],
                    [{ imageId: "generic-6", orientation: 8 }],
                    [{ imageId: "generic-7", orientation: 8 }],
                    []
                ],
                "item-in-use": [
                    [{ imageId: "generic-carrying-0", orientation: 8 }],
                    [{ imageId: "generic-carrying-1", orientation: 8 }],
                    [{ imageId: "generic-carrying-2", orientation: 8 }],
                    [{ imageId: "generic-carrying-3", orientation: 8 }],
                    [{ imageId: "generic-carrying-4", orientation: 8 }],
                    [{ imageId: "generic-carrying-5", orientation: 8 }],
                    [{ imageId: "generic-carrying-6", orientation: 8 }],
                    [{ imageId: "generic-carrying-7", orientation: 8 }],
                    []
                ]
            },
            dead: [{ imageId: "generic-dead" }],
            default: []
        },
        "fire-mode": {
            default: [{ imageId: "generic-cl", orientation: 8 }],
            dead: []
        },
        default: []
    };
    const objectRenderableRecipe = {
        default: [{ imageId: "m4+m203" }],
        "fire-mode": []
    };
    const terrainRenderableRecipe = {
        default: [{ imageId: "grass" }],
        "fire-mode": []
    };
    const furnitureRenderableRecipe = {
        default: {
            default: [{ imageId: "wall" }, { imageId: "wall", orientation: 2 }],
            destroyed: []
        },
        "fire-mode": {
            default: [{ imageId: "wall-cl" }, { imageId: "wall-cl", orientation: 2 }],
            destroyed: []
        }
    };

    it("should parse the object", () => {
        expect(
            ModeNode.parse({
                [RenderMode.enum.MAP_MODE]: {
                    default: [{ imageId: "idle" }],
                    playing: [
                        { imageId: "n" },
                        { imageId: "ne" },
                        { imageId: "e" },
                        { imageId: "se" },
                        { imageId: "s" },
                        { imageId: "sw" },
                        { imageId: "w" },
                        { imageId: "nw" }
                    ],
                    paused: { default: [{ imageId: "paused-fallback" }] }
                },
                default: []
            })
        );
    });

    it("should parse the example unit renderable recipe", () => {
        expect(ModeNode.parse(unitRenderableRecipe));
    });

    it("should parse the example object renderable recipe", () => {
        expect(ModeNode.parse(objectRenderableRecipe));
    });

    it("should parse the example terraint renderable recipe", () => {
        expect(ModeNode.parse(terrainRenderableRecipe));
    });

    it("should parse the example furniture renderable recipe", () => {
        expect(ModeNode.parse(furnitureRenderableRecipe));
    });

    describe("Renderable", () => {
        let renderable: Renderable;

        beforeEach(() => {
            renderable = new Renderable({
                default: {
                    "state-1": {
                        "state-2": {
                            "state-3": {
                                default: [{ imageId: "matched-state-3" }]
                            },
                            default: [{ imageId: "did-not-match-state-3" }]
                        },
                        "state-2-dir": [
                            [{ imageId: "state-2-orientation-n" }],
                            [{ imageId: "state-2-orientation-ne" }],
                            [{ imageId: "state-2-orientation-e" }],
                            [{ imageId: "state-2-orientation-se" }],
                            [{ imageId: "state-2-orientation-s" }],
                            [{ imageId: "state-2-orientation-sw" }],
                            [{ imageId: "state-2-orientation-w" }],
                            [{ imageId: "state-2-orientation-nw" }],
                            [{ imageId: "state-2-orientation-center" }]
                        ],
                        default: [{ imageId: "did-not-match-state-2" }]
                    },
                    "state-1-dir": [
                        [{ imageId: "state-1-orientation-n" }],
                        [{ imageId: "state-1-orientation-ne" }],
                        [{ imageId: "state-1-orientation-e" }],
                        [{ imageId: "state-1-orientation-se" }],
                        [{ imageId: "state-1-orientation-s" }],
                        [{ imageId: "state-1-orientation-sw" }],
                        [{ imageId: "state-1-orientation-w" }],
                        [{ imageId: "state-1-orientation-nw" }],
                        [{ imageId: "state-1-orientation-center" }]
                    ],
                    centred: [{ imageId: "centred", orientation: Orientation.CENTER }],
                    "facing-south-west": [
                        { imageId: "facing-south-west", orientation: Orientation.SOUTH_WEST }
                    ],
                    default: [{ imageId: "did-not-match-state-1" }]
                }
            });
        });

        const tests: {
            test: string;
            context: RenderableContext;
            expected: RenderImage[];
        }[] = [
            {
                test: "not match any state",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: 0,
                    states: []
                },
                expected: [{ imageId: "did-not-match-state-1" }]
            },
            {
                test: "not match anything beyond 'state-1'",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: 0,
                    states: ["state-1"]
                },
                expected: [{ imageId: "did-not-match-state-2" }]
            },
            {
                test: "not match anything beyond 'state-2'",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: 0,
                    states: ["state-1", "state-2"]
                },
                expected: [{ imageId: "did-not-match-state-3" }]
            },
            {
                test: "match all state",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: 0,
                    states: ["state-1", "state-2", "state-3"]
                },
                expected: [{ imageId: "matched-state-3" }]
            },
            {
                test: "match all state (even with some left over)",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: 0,
                    states: ["state-1", "state-2", "state-3", "state-4"]
                },
                expected: [{ imageId: "matched-state-3" }]
            },
            {
                test: "matches 'state-1' and an orientation",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: Orientation.EAST,
                    states: ["state-1-dir"]
                },
                expected: [{ imageId: "state-1-orientation-e" }]
            },
            {
                test: "matches 'state-1' and an orientation",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: Orientation.EAST,
                    states: ["state-1-dir"]
                },
                expected: [{ imageId: "state-1-orientation-e" }]
            },
            {
                test: "matches 'state-1' and an orientation",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: Orientation.CENTER,
                    states: ["state-1", "state-2-dir"]
                },
                expected: [{ imageId: "state-2-orientation-center" }]
            },
            {
                test: "does not apply orientation because it centred",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: Orientation.CENTER,
                    applyOrientation: 2,
                    states: ["centred"]
                },
                expected: [{ imageId: "centred", orientation: Orientation.CENTER }]
            },
            {
                test: "applies the orientation and wraps it (cw)",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: Orientation.SOUTH_WEST,
                    applyOrientation: 4,
                    states: ["facing-south-west"]
                },
                expected: [{ imageId: "facing-south-west", orientation: Orientation.NORTH_EAST }]
            },
            {
                test: "applies the orientation and wraps it (acw)",
                context: {
                    renderMode: RenderMode.enum.UI_MODE,
                    orientation: Orientation.SOUTH_WEST,
                    applyOrientation: -6,
                    states: ["facing-south-west"]
                },
                expected: [{ imageId: "facing-south-west", orientation: Orientation.NORTH_WEST }]
            }
        ];

        it.only.each(tests)("should $test", ({ context, expected }: (typeof tests)[0]) => {
            expect(renderable.getRenderList(context)).toStrictEqual(expected);
        });
    });
});
