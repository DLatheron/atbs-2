import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ClientMap,
    EditorHistoryState,
    FurniturePaletteWire,
    SelectedFurniture,
    SelectedTerrain,
    TerrainPaletteWire
} from "@atbs/shared-data";
import { useEditorMessageManager, useEditorWorld, useImageCache, useKeyboard } from "../../hooks";
import { applyTileUpdates } from "../../mapUpdates";
import { createDefaultSelectedFurniture } from "../../helpers/furnitureHelpers";
import { createDefaultSelectedTerrain } from "../../helpers/terrainHelpers";
import { EditorPanelMode, EditorWorld } from "../../EditorWorld";

export function useEditorPage() {
    const { messageManager, sendMessage } = useEditorMessageManager();
    const { world } = useEditorWorld();
    const { imageCache } = useImageCache();
    const [map, setMap] = useState<ClientMap | null>(null);
    const [terrainPalette, setTerrainPalette] = useState<TerrainPaletteWire | null>(null);
    const [furniturePalette, setFurniturePalette] = useState<FurniturePaletteWire | null>(null);
    const [selectedTerrain, setSelectedTerrain] = useState<SelectedTerrain>(
        createDefaultSelectedTerrain()
    );
    const [selectedFurniture, setSelectedFurniture] = useState<SelectedFurniture>(
        createDefaultSelectedFurniture()
    );
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
        world.editorPanel = editorPanel;
        world.syncEditorState();
    }, [world, editorPanel]);

    useEffect(() => {
        console.info("Mounting EditorPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:editor:map", (_context, payload) => {
                console.info("Received editor map", payload.width, "x", payload.height);
                world.map = payload;
                setMap(payload);
            }),

            messageManager.registerHandler("server:editor:terrain:palette", (_context, payload) => {
                world.terrainPalette = payload;
                setTerrainPalette(payload);
            }),

            messageManager.registerHandler("server:editor:furniture:palette", (_context, payload) => {
                world.furniturePalette = payload;
                setFurniturePalette(payload);
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
            } else {
                setSelectedTerrain({ ...(world as EditorWorld).selectedTerrain });
            }
        },
        [world, editorPanel]
    );

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
            BracketRight: () => rotateSelection(2)
        }),
        [onRedo, onUndo, rotateSelection]
    );

    useKeyboard({
        keyMap,
        disabled: false
    });

    return {
        map,
        terrainPalette,
        furniturePalette,
        selectedTerrain,
        setSelectedTerrain,
        selectedFurniture,
        setSelectedFurniture,
        editorPanel,
        setEditorPanel,
        history,
        savedMessage,
        onSave,
        onUndo,
        onRedo
    };
}
