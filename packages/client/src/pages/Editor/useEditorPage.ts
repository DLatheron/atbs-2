import {
    EditorHistoryState,
    EditorMapWire,
    EditorMarkersState,
    FurniturePaletteWire,
    ItemPaletteWire,
    MapResizeAnchor,
    MarkerSideId,
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
import { Orientation } from "@atbs/maths";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useEditorPage() {
    const { messageManager, sendMessage } = useEditorMessageManager();
    const { world } = useEditorWorld();
    const { imageCache } = useImageCache();
    const [map, setMap] = useState<EditorMapWire | null>(null);
    const [terrainPalette, setTerrainPalette] = useState<TerrainPaletteWire | null>(null);
    const [furniturePalette, setFurniturePalette] = useState<FurniturePaletteWire | null>(null);
    const [wallPalette, setWallPalette] = useState<WallPaletteWire | null>(null);
    const [itemPalette, setItemPalette] = useState<ItemPaletteWire | null>(null);
    const [markersState, setMarkersState] = useState<EditorMarkersState | null>(null);
    const [markersSavedMessage, setMarkersSavedMessage] = useState<string | null>(null);
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
        canRedo: false,
        hasUnsavedChanges: false
    });
    const [savedMessage, setSavedMessage] = useState<string | null>(null);
    const [mapDetailsOpen, setMapDetailsOpen] = useState(false);
    const [newMapOpen, setNewMapOpen] = useState(false);

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
        (world as EditorWorld).markersState = markersState;
    }, [world, markersState]);

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

            messageManager.registerHandler("server:editor:markers:state", (_context, payload) => {
                setMarkersState(payload);
            }),

            messageManager.registerHandler("server:editor:markers:saved", (_context, payload) => {
                const message = `Saved markers as ${payload.filename}`;
                console.info(message);
                setMarkersSavedMessage(message);
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

    useEffect(() => {
        if (!markersSavedMessage) {
            return;
        }
        const timer = window.setTimeout(() => setMarkersSavedMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [markersSavedMessage]);

    const onSave = useCallback(() => {
        sendMessage({
            type: "client:editor:save",
            payload: {}
        });
    }, [sendMessage]);

    const onOpenMapDetails = useCallback(() => {
        setMapDetailsOpen(true);
    }, []);

    const onCloseMapDetails = useCallback(() => {
        setMapDetailsOpen(false);
    }, []);

    const onOpenNewMap = useCallback(() => {
        setNewMapOpen(true);
    }, []);

    const onCloseNewMap = useCallback(() => {
        setNewMapOpen(false);
    }, []);

    const onConfirmMapDetails = useCallback(
        (details: {
            width: number;
            height: number;
            anchor: MapResizeAnchor;
            defaultTerrainId: string;
            defaultOrientation: Orientation;
            randomiseOrientation: boolean;
        }) => {
            sendMessage({
                type: "client:editor:map:resize",
                payload: details
            });
            setMapDetailsOpen(false);
        },
        [sendMessage]
    );

    const onConfirmNewMap = useCallback(
        (details: {
            width: number;
            height: number;
            defaultTerrainId: string;
            defaultOrientation: Orientation;
            randomiseOrientation: boolean;
        }) => {
            sendMessage({
                type: "client:editor:map:new",
                payload: details
            });
            setNewMapOpen(false);
        },
        [sendMessage]
    );

    const onUndo = useCallback(() => {
        (world as EditorWorld).undo();
    }, [world]);

    const onRedo = useCallback(() => {
        (world as EditorWorld).redo();
    }, [world]);

    const onSelectMarkerSide = useCallback(
        (sideId: MarkerSideId) => {
            sendMessage({ type: "client:editor:markers:select-side", payload: { sideId } });
        },
        [sendMessage]
    );

    const onSelectMarkerZone = useCallback(
        (zoneId: string | null) => {
            sendMessage({ type: "client:editor:markers:select-zone", payload: { zoneId } });
        },
        [sendMessage]
    );

    const onNewMarkerZone = useCallback(() => {
        sendMessage({ type: "client:editor:markers:new-zone", payload: {} });
    }, [sendMessage]);

    const onDoneMarkerZone = useCallback(() => {
        sendMessage({ type: "client:editor:markers:done-zone", payload: {} });
    }, [sendMessage]);

    const onDeleteMarkerZone = useCallback(() => {
        if (!markersState?.selectedZoneId) {
            return;
        }
        sendMessage({
            type: "client:editor:markers:delete-zone",
            payload: { zoneId: markersState.selectedZoneId }
        });
    }, [sendMessage, markersState?.selectedZoneId]);

    const onUpdateMarkerZone = useCallback(
        (updates: {
            name?: string;
            minUnits?: number | null;
            maxUnits?: number | null;
            orientation?: Orientation;
        }) => {
            if (!markersState?.selectedZoneId) {
                return;
            }
            sendMessage({
                type: "client:editor:markers:update-zone",
                payload: {
                    zoneId: markersState.selectedZoneId,
                    ...updates
                }
            });
        },
        [sendMessage, markersState?.selectedZoneId]
    );

    const onSaveMarkers = useCallback(() => {
        sendMessage({ type: "client:editor:markers:save", payload: {} });
    }, [sendMessage]);

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
        markersState,
        markersSavedMessage,
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
        mapDetailsOpen,
        onOpenMapDetails,
        onCloseMapDetails,
        onConfirmMapDetails,
        newMapOpen,
        onOpenNewMap,
        onCloseNewMap,
        onConfirmNewMap,
        onUndo,
        onRedo,
        onSelectMarkerSide,
        onSelectMarkerZone,
        onNewMarkerZone,
        onDoneMarkerZone,
        onDeleteMarkerZone,
        onUpdateMarkerZone,
        onSaveMarkers
    };
}
