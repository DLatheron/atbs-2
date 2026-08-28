import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ClientMap,
    EditorHistoryState,
    SelectedTerrain,
    TerrainPaletteWire
} from "@atbs/shared-data";
import { rotateOrientation } from "@atbs/maths";
import { useEditorMessageManager, useEditorWorld, useImageCache, useKeyboard } from "../../hooks";
import { applyTileUpdates } from "../../mapUpdates";
import { createDefaultSelectedTerrain } from "../../helpers/terrainHelpers";
import { EditorWorld } from "../../EditorWorld";

export function useEditorPage() {
    const { messageManager, sendMessage } = useEditorMessageManager();
    const { world } = useEditorWorld();
    const { imageCache } = useImageCache();
    const [map, setMap] = useState<ClientMap | null>(null);
    const [terrainPalette, setTerrainPalette] = useState<TerrainPaletteWire | null>(null);
    const [selectedTerrain, setSelectedTerrain] = useState<SelectedTerrain>(
        createDefaultSelectedTerrain()
    );
    const [history, setHistory] = useState<EditorHistoryState>({
        canUndo: false,
        canRedo: false
    });
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    useEffect(() => {
        world.selectedTerrain = selectedTerrain;
    }, [world, selectedTerrain]);

    useEffect(() => {
        world.terrainModeActive = true;
    }, [world]);

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

    const rotateTerrain = useCallback((steps: -2 | 2) => {
        setSelectedTerrain((current: SelectedTerrain) => ({
            ...current,
            orientation: rotateOrientation(current.orientation, steps)
        }));
    }, []);

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
            BracketLeft: () => rotateTerrain(-2),
            BracketRight: () => rotateTerrain(2)
        }),
        [onRedo, onUndo, rotateTerrain]
    );

    useKeyboard({
        keyMap,
        disabled: false
    });

    return {
        map,
        terrainPalette,
        selectedTerrain,
        setSelectedTerrain,
        history,
        savedMessage,
        onSave,
        onUndo,
        onRedo
    };
}
