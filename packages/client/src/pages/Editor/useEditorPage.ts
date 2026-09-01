import { useCallback, useEffect, useMemo, useState } from "react";
import { Orientation } from "@atbs/maths";
import {
    EditorHistoryState,
    EditorMapWire,
    FurniturePaletteWire,
    ItemPaletteWire,
    SelectedFurniture,
    SelectedItem,
    SelectedTerrain,
    SelectedWall,
    TerrainPaletteWire,
    WallPaletteWire
} from "@atbs/shared-data";
import { useEditorMessageManager, useEditorWorld, useImageCache, useKeyboard } from "../../hooks";
import { applyTileUpdates } from "../../mapUpdates";
import { createDefaultSelectedFurniture } from "../../helpers/furnitureHelpers";
import { createDefaultSelectedItem } from "../../helpers/itemHelpers";
import { createDefaultSelectedTerrain } from "../../helpers/terrainHelpers";
import { applyWallHotKey, createDefaultSelectedWall } from "../../helpers/wallHelpers";
import { EditorPanelMode, EditorWorld } from "../../EditorWorld";

export function useEditorPage() {
    const { messageManager, sendMessage } = useEditorMessageManager();
    const { world } = useEditorWorld();
    const { imageCache } = useImageCache();
    const [map, setMap] = useState<EditorMapWire | null>(null);
    const [terrainPalette, setTerrainPalette] = useState<TerrainPaletteWire | null>(null);
    const [furniturePalette, setFurniturePalette] = useState<FurniturePaletteWire | null>(null);
    const [wallPalette, setWallPalette] = useState<WallPaletteWire | null>(null);
    const [itemPalette, setItemPalette] = useState<ItemPaletteWire | null>(null);
    const [selectedTerrain, setSelectedTerrain] = useState<SelectedTerrain>(
        createDefaultSelectedTerrain()
    );
    const [selectedFurniture, setSelectedFurniture] = useState<SelectedFurniture>(
        createDefaultSelectedFurniture()
    );
    const [selectedWall, setSelectedWall] = useState<SelectedWall>(createDefaultSelectedWall());
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(createDefaultSelectedItem());
    const [editorPanel, setEditorPanel] = useState<EditorPanelMode>("Terrain");
    const [history, setHistory] = useState<EditorHistoryState>({
        canUndo: false,
        canRedo: false
    });
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    useEffect(() => {
        world.selectedTerrain = selectedTerrain;
    }, [world, selectedTerrain]);

    useEffect(() => {
        world.selectedFurniture = selectedFurniture;
        world.syncEditorState();
    }, [world, selectedFurniture]);

    useEffect(() => {
        world.selectedWall = selectedWall;
    }, [world, selectedWall]);

    useEffect(() => {
        world.selectedItem = selectedItem;
    }, [world, selectedItem]);

    useEffect(() => {
        (world as EditorWorld).onSelectedWallChange = setSelectedWall;
        return () => {
            (world as EditorWorld).onSelectedWallChange = null;
        };
    }, [world]);

    useEffect(() => {
        world.editorPanel = editorPanel;
        world.syncEditorState();
    }, [world, editorPanel]);

    useEffect(() => {
        console.info("Mounting EditorPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:editor:map", (_context, payload) => {
                console.info("Received editor map", payload.width, "x", payload.height);
                world.map = payload;
                (world as EditorWorld).furnitureLayer = payload.furnitureLayer;
                setMap(payload);
            }),

            messageManager.registerHandler("server:editor:terrain:palette", (_context, payload) => {
                world.terrainPalette = payload;
                setTerrainPalette(payload);
            }),

            messageManager.registerHandler(
                "server:editor:furniture:palette",
                (_context, payload) => {
                    world.furniturePalette = payload;
                    setFurniturePalette(payload);
                }
            ),

            messageManager.registerHandler("server:editor:wall:palette", (_context, payload) => {
                world.wallPalette = payload;
                setWallPalette(payload);
            }),

            messageManager.registerHandler("server:editor:item:palette", (_context, payload) => {
                world.itemPalette = payload;
                setItemPalette(payload);
            }),

            messageManager.registerHandler("server:editor:map:update", (_context, payload) => {
                if (!world.hasMap) {
                    return;
                }
                applyTileUpdates(world.map, payload, imageCache);
                setMap({ ...world.map });
            }),

            messageManager.registerHandler("server:editor:history", (_context, payload) => {
                setHistory(payload);
            }),

            messageManager.registerHandler("server:editor:saved", (_context, payload) => {
                const message = `Saved ${payload.mapId} as ${payload.filename}`;
                console.info(message);
                setSavedMessage(message);
            })
        ];

        return () => {
            console.info("Unmounting EditorPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, world, imageCache]);

    useEffect(() => {
        if (!savedMessage) {
            return;
        }
        const timer = window.setTimeout(() => setSavedMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [savedMessage]);

    const onSave = useCallback(() => {
        sendMessage({
            type: "client:editor:save",
            payload: {}
        });
    }, [sendMessage]);

    const onUndo = useCallback(() => {
        (world as EditorWorld).undo();
    }, [world]);

    const onRedo = useCallback(() => {
        (world as EditorWorld).redo();
    }, [world]);

    const rotateSelection = useCallback(
        (steps: -2 | 2) => {
            (world as EditorWorld).rotateSelection(steps);
            if (editorPanel === "Furniture") {
                setSelectedFurniture({ ...(world as EditorWorld).selectedFurniture });
            } else if (editorPanel === "Walls") {
                setSelectedWall({ ...(world as EditorWorld).selectedWall });
            } else {
                setSelectedTerrain({ ...(world as EditorWorld).selectedTerrain });
            }
        },
        [world, editorPanel]
    );

    useEffect(() => {
        if (editorPanel !== "Walls" || !wallPalette) {
            return;
        }

        const onWallHotKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            setSelectedWall(
                (current: SelectedWall) =>
                    applyWallHotKey(wallPalette, current, event.key) ?? current
            );
        };

        window.addEventListener("keydown", onWallHotKeyDown);
        return () => window.removeEventListener("keydown", onWallHotKeyDown);
    }, [editorPanel, wallPalette]);

    const keyMap = useMemo(
        () => ({
            KeyZ: (event: KeyboardEvent) => {
                if (!(event.ctrlKey || event.metaKey)) {
                    return;
                }
                if (event.shiftKey) {
                    onRedo();
                } else {
                    onUndo();
                }
            },
            BracketLeft: () => rotateSelection(-2),
            BracketRight: () => rotateSelection(2),
            ArrowUp: () => {
                if (editorPanel === "Walls") {
                    (world as EditorWorld).setWallDirection(Orientation.NORTH);
                }
            },
            ArrowRight: () => {
                if (editorPanel === "Walls") {
                    (world as EditorWorld).setWallDirection(Orientation.EAST);
                }
            },
            ArrowDown: () => {
                if (editorPanel === "Walls") {
                    (world as EditorWorld).setWallDirection(Orientation.SOUTH);
                }
            },
            ArrowLeft: () => {
                if (editorPanel === "Walls") {
                    (world as EditorWorld).setWallDirection(Orientation.WEST);
                }
            }
        }),
        [onRedo, onUndo, rotateSelection, editorPanel, world]
    );

    const keyUpMap = useMemo(
        () => ({
            ArrowUp: () => {
                if (editorPanel === "Walls") {
                    (world as EditorWorld).setWallDirection(undefined);
                }
            },
            ArrowRight: () => {
                if (editorPanel === "Walls") {
                    (world as EditorWorld).setWallDirection(undefined);
                }
            },
            ArrowDown: () => {
                if (editorPanel === "Walls") {
                    (world as EditorWorld).setWallDirection(undefined);
                }
            },
            ArrowLeft: () => {
                if (editorPanel === "Walls") {
                    (world as EditorWorld).setWallDirection(undefined);
                }
            }
        }),
        [editorPanel, world]
    );

    useKeyboard({
        keyMap,
        keyUpMap,
        disabled: false
    });

    return {
        map,
        terrainPalette,
        furniturePalette,
        wallPalette,
        itemPalette,
        selectedTerrain,
        setSelectedTerrain,
        selectedFurniture,
        setSelectedFurniture,
        selectedWall,
        setSelectedWall,
        selectedItem,
        setSelectedItem,
        editorPanel,
        setEditorPanel,
        history,
        savedMessage,
        onSave,
        onUndo,
        onRedo
    };
}
