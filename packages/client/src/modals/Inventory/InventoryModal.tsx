import { Box, Modal, Typography } from "@mui/material";
import type { InventorySnapshot, ItemId } from "@atbs/shared-data";
import { useEffect, useState } from "react";
import {
    InventoryBoard,
    type InventoryActionScope,
    type InventoryInspectorFocus,
    type InventoryMode
} from "../../components/Inventory";
import { getAttributeValue } from "../../helpers/formattingHelpers";

export interface InventoryModalProps {
    open: boolean;
    snapshot: InventorySnapshot | null;
    mode?: InventoryMode;
    actionScope?: InventoryActionScope;
    inspectorFocus?: InventoryInspectorFocus;
    disabled?: boolean;
    onClose: () => void;
    onUse: (itemId: ItemId) => void;
    onUnuse: () => void;
    onDrop: (itemId: ItemId) => void;
    onPickup: (itemId: ItemId, use?: boolean) => void;
    onLoad: (receiverId: ItemId, ammoId: ItemId) => void;
    onUnload: (itemId: ItemId) => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
}

export function InventoryModal({
    open,
    snapshot,
    mode = "action",
    actionScope = "inUse",
    inspectorFocus = "inUse",
    disabled = false,
    onClose,
    onUse,
    onUnuse,
    onDrop,
    onPickup,
    onLoad,
    onUnload,
    onReorder
}: InventoryModalProps) {
    const [pendingCost, setPendingCost] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setPendingCost(null);
        }
    }, [open]);

    if (!snapshot) {
        return null;
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            aria-labelledby="inventory-modal-title"
            aria-describedby="inventory-modal-description"
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            <Box
                data-testid="inventory-modal-content"
                sx={{
                    position: "relative",
                    width: "960px",
                    maxWidth: "1200px",
                    height: "800px",
                    maxHeight: "800px",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    bgcolor: "background.paper",
                    border: "2px solid #000",
                    boxShadow: 24,
                    borderRadius: 4,
                    p: 1,
                    outline: "none"
                }}
            >
                <Box
                    data-testid="inventory-modal-header"
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gridTemplateAreas: "'title action budget'"
                    }}
                >
                    <Typography
                        id="inventory-modal-title"
                        variant="h6"
                        component="h2"
                        sx={{ gridArea: "title" }}
                    >
                        Inventory
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            gridArea: "action",
                            m: "auto",
                            color: pendingCost ? "#333" : "#666",
                            minHeight: "1.25em"
                        }}
                    >
                        {pendingCost ?? ""}
                    </Typography>
                    <Box
                        id="inventory-modal-description"
                        sx={{ textAlign: "right", gridArea: "budget" }}
                    >
                        <Typography variant="h6" component="p">
                            AP {getAttributeValue(snapshot.actionPoints)}
                        </Typography>
                    </Box>
                </Box>
                <InventoryBoard
                    snapshot={snapshot}
                    mode={mode}
                    actionScope={actionScope}
                    inspectorFocus={inspectorFocus}
                    disabled={disabled}
                    onUse={onUse}
                    onUnuse={onUnuse}
                    onDrop={onDrop}
                    onPickup={onPickup}
                    onLoad={onLoad}
                    onUnload={onUnload}
                    onReorder={onReorder}
                    onPendingCostChange={setPendingCost}
                    sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}
                />
            </Box>
        </Modal>
    );
}
