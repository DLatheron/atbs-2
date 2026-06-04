import "react";
import { Box, Modal, Typography } from "@mui/material";
import { Phase, SideId, WaitingFor } from "@atbs/shared-data";

export interface WaitModalProps {
    waitingFor: WaitingFor | null;
}

function resolvePhaseName(phase: Phase | undefined): string {
    switch (phase) {
        case Phase.enum.armament:
            return "Armament Phase";

        case Phase.enum.deployment:
            return "Deployment Phase";

        case Phase.enum.action:
            return "Action Phase";
    }

    return "Unknown";
}

export function WaitModal({ waitingFor }: WaitModalProps) {
    const style = {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 400,
        bgcolor: "background.paper",
        border: "2px solid #000",
        boxShadow: 24,
        p: 4
    };

    return (
        <Modal
            open={!!waitingFor}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <Box sx={style}>
                <Typography id="modal-modal-title" variant="h6" component="h2">
                    {resolvePhaseName(waitingFor?.phase)} Waiting
                </Typography>
                <Typography id="modal-modal-description" component="ul" sx={{ mt: 2 }}>
                    {waitingFor?.sides.map(({ id, name }: { id: SideId; name: string }) => (
                        <li key={id}>{name}</li>
                    ))}
                </Typography>
            </Box>
        </Modal>
    );
}
