import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ErrorType,
    InventorySnapshot,
    ItemId,
    StoreSnapshot,
    UnitId,
    UnitSummary
} from "@atbs/shared-data";
import { useServerMessageManager } from "../../hooks";
import { ERROR_MESSAGES } from "../../helpers/formattingHelpers";

export function useArmamentPage() {
    const { messageManager, sendMessage } = useServerMessageManager();
    const [units, setUnits] = useState<UnitSummary[]>([]);
    const [store, setStore] = useState<StoreSnapshot | null>(null);
    const [inventories, setInventories] = useState<Record<UnitId, InventorySnapshot>>({});
    const [selectedUnitId, setSelectedUnitId] = useState<UnitId | null>(null);
    const [error, setError] = useState<string | null>(null);

    /*
     * Registered on mount, not on `visible`: the server sends `server:armament:state`
     * immediately after `server:phase`, long before React has re-rendered this page.
     */
    useEffect(() => {
        const handles = [
            messageManager.registerHandler("server:armament:state", (_context, payload) => {
                setUnits(payload.units);
                setStore(payload.store);
                const nextInventories: Record<UnitId, InventorySnapshot> = {};
                for (const inventory of payload.inventories) {
                    nextInventories[inventory.unitId] = inventory;
                }
                setInventories(nextInventories);
                setSelectedUnitId((current) => current ?? payload.units[0]?.id ?? null);
            }),
            messageManager.registerHandler("server:armament:update", (_context, payload) => {
                setStore(payload.store);
                setInventories((current) => ({
                    ...current,
                    [payload.unitId]: payload.inventory
                }));
                setUnits((current) =>
                    current.map((unit) => (unit.id === payload.unit.id ? payload.unit : unit))
                );
                setError(null);
            }),
            messageManager.registerHandler("server:error", (_context, payload) => {
                setError(ERROR_MESSAGES[payload as ErrorType] ?? String(payload));
            })
        ];

        return () => {
            messageManager.unregisterHandlers(handles);
        };
    }, [messageManager]);

    const selectedUnit = useMemo(
        () => units.find((unit) => unit.id === selectedUnitId) ?? null,
        [units, selectedUnitId]
    );
    const snapshot = selectedUnitId ? (inventories[selectedUnitId] ?? null) : null;

    const onEndArmamentPhase = useCallback(() => {
        sendMessage({
            type: "client:armament:end",
            payload: null
        });
    }, [sendMessage]);

    const sendForSelected = useCallback(
        (build: (unitId: UnitId) => Parameters<typeof sendMessage>[0]) => {
            if (!selectedUnitId) {
                return;
            }
            sendMessage(build(selectedUnitId));
        },
        [selectedUnitId, sendMessage]
    );

    const onUse = useCallback(
        (itemId: ItemId) => {
            sendForSelected((unitId) => ({
                type: "client:armament:use",
                payload: { unitId, itemId }
            }));
        },
        [sendForSelected]
    );

    const onUnuse = useCallback(() => {
        sendForSelected((unitId) => ({
            type: "client:armament:unuse",
            payload: { unitId }
        }));
    }, [sendForSelected]);

    const onLoad = useCallback(
        (receiverId: ItemId, ammoId: ItemId) => {
            sendForSelected((unitId) => ({
                type: "client:armament:load",
                payload: { unitId, receiverId, ammoId }
            }));
        },
        [sendForSelected]
    );

    const onUnload = useCallback(
        (itemId: ItemId) => {
            sendForSelected((unitId) => ({
                type: "client:armament:unload",
                payload: { unitId, itemId }
            }));
        },
        [sendForSelected]
    );

    const onReorder = useCallback(
        (fromIndex: number, toIndex: number) => {
            sendForSelected((unitId) => ({
                type: "client:armament:reorder",
                payload: { unitId, fromIndex, toIndex }
            }));
        },
        [sendForSelected]
    );

    const onBuy = useCallback(
        (itemId: ItemId, use?: boolean) => {
            sendForSelected((unitId) => ({
                type: "client:armament:buy",
                payload: { unitId, itemId, use }
            }));
        },
        [sendForSelected]
    );

    const onSell = useCallback(
        (itemId: ItemId, quantity: number) => {
            sendForSelected((unitId) => ({
                type: "client:armament:sell",
                payload: { unitId, itemId, quantity }
            }));
        },
        [sendForSelected]
    );

    return {
        units,
        selectedUnit,
        selectedUnitId,
        setSelectedUnitId,
        snapshot,
        store,
        onEndArmamentPhase,
        onUse,
        onUnuse,
        onLoad,
        onUnload,
        onReorder,
        onBuy,
        onSell,
        error
    };
}
