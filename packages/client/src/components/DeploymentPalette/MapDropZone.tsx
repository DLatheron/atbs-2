import Box from "@mui/material/Box";
import { useDroppable } from "@dnd-kit/core";

export const DEPLOYMENT_MAP_ZONE_ID = "zone:map";

export function MapDropZone({ disabled = false }: { disabled?: boolean }) {
    const { setNodeRef } = useDroppable({
        id: DEPLOYMENT_MAP_ZONE_ID,
        data: { type: "map-zone" },
        disabled
    });

    return (
        <Box
            ref={setNodeRef}
            data-testid="deployment-map-drop-zone"
            sx={{
                position: "absolute",
                inset: 0,
                // Collision detection uses the node rect; keep pointer events off so
                // canvas panning / zoom still receive mouse and wheel events.
                pointerEvents: "none",
                zIndex: 1
            }}
        />
    );
}
