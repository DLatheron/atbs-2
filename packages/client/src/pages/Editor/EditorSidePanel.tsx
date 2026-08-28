import { Box, Button, Tab, Tabs, Typography } from "@mui/material";
import { useState } from "react";

const EDITOR_TABS = ["Terrain", "Furniture", "Walls", "Items", "Markers"] as const;
type EditorTab = (typeof EDITOR_TABS)[number];

export interface EditorSidePanelProps {
    onSave: () => void;
    savedMessage: string | null;
}

export function EditorSidePanel({ onSave, savedMessage }: EditorSidePanelProps) {
    const [tab, setTab] = useState<EditorTab>("Terrain");

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                p: 1,
                boxSizing: "border-box"
            }}
        >
            <Tabs
                value={tab}
                onChange={(_event, value: EditorTab) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 40, borderBottom: 1, borderColor: "divider" }}
            >
                {EDITOR_TABS.map((label) => (
                    <Tab key={label} label={label} value={label} sx={{ minHeight: 40, py: 0 }} />
                ))}
            </Tabs>

            <Box sx={{ flex: 1, py: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    {tab}: Coming soon
                </Typography>
            </Box>

            {savedMessage ? (
                <Typography variant="caption" color="success.main" sx={{ mb: 1 }}>
                    {savedMessage}
                </Typography>
            ) : null}

            <Button variant="contained" fullWidth onClick={onSave}>
                Save
            </Button>
        </Box>
    );
}
