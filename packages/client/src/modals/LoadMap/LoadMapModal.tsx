import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItemButton,
    ListItemText,
    Typography
} from "@mui/material";
import { EditorMapListEntry, EditorMapSource } from "@atbs/shared-data";
import { useEffect, useMemo, useState } from "react";

export interface LoadMapModalProps {
    open: boolean;
    hasUnsavedChanges: boolean;
    maps: EditorMapListEntry[] | null;
    loading: boolean;
    onClose: () => void;
    onRequestList: () => void;
    onConfirm: (selection: { source: EditorMapSource; key: string }) => void;
}

function sourceLabel(source: EditorMapSource): string {
    return source === "defined" ? "Defined maps" : "Editor saves";
}

export function LoadMapModal({
    open,
    hasUnsavedChanges,
    maps,
    loading,
    onClose,
    onRequestList,
    onConfirm
}: LoadMapModalProps) {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        setSelectedKey(null);
        onRequestList();
    }, [open, onRequestList]);

    const selectedEntry = useMemo(() => {
        return maps?.find((entry) => `${entry.source}:${entry.key}` === selectedKey) ?? null;
    }, [maps, selectedKey]);

    const definedMaps = useMemo(
        () => maps?.filter((entry) => entry.source === "defined") ?? [],
        [maps]
    );
    const savedMaps = useMemo(
        () => maps?.filter((entry) => entry.source === "editor-save") ?? [],
        [maps]
    );

    const handleConfirm = () => {
        if (!selectedEntry) {
            return;
        }

        onConfirm({
            source: selectedEntry.source,
            key: selectedEntry.key
        });
    };

    const renderGroup = (title: string, entries: EditorMapListEntry[]) => {
        if (entries.length === 0) {
            return (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        None available
                    </Typography>
                </Box>
            );
        }

        return (
            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    {title}
                </Typography>
                <List
                    dense
                    disablePadding
                    sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
                >
                    {entries.map((entry) => {
                        const itemKey = `${entry.source}:${entry.key}`;
                        return (
                            <ListItemButton
                                key={itemKey}
                                selected={selectedKey === itemKey}
                                onClick={() => setSelectedKey(itemKey)}
                            >
                                <ListItemText
                                    primary={entry.name}
                                    secondary={
                                        entry.filename
                                            ? `${entry.width}×${entry.height} · ${entry.filename}`
                                            : `${entry.width}×${entry.height} · ${entry.id}`
                                    }
                                />
                            </ListItemButton>
                        );
                    })}
                </List>
            </Box>
        );
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Load Map</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {hasUnsavedChanges ? (
                    <Alert severity="warning">
                        You have unsaved changes. Loading a map will discard them and will not save
                        the current map.
                    </Alert>
                ) : null}

                {loading || maps === null ? (
                    <Typography variant="body2" color="text.secondary">
                        Loading maps…
                    </Typography>
                ) : (
                    <>
                        {renderGroup(sourceLabel("defined"), definedMaps)}
                        {renderGroup(sourceLabel("editor-save"), savedMaps)}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" disabled={!selectedEntry} onClick={handleConfirm}>
                    Load
                </Button>
            </DialogActions>
        </Dialog>
    );
}
