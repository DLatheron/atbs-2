import "react";
import { Box, Modal, Typography } from "@mui/material";
import { Phase, WaitingFor } from "@atbs/shared-data";

export interface WaitModalProps {
    waitingFor: WaitingFor | null;
}

function resolvePhaseName(phase: Phase | undefined): string {
    switch (phase) {
        case Phase.Enum.armament:
            return "Armament Phase";

        case Phase.Enum.deployment:
            return "Deployment Phase";

        case Phase.Enum.action:
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
                <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                    <ul>
                        {waitingFor?.sides.map(({ id, name }) => (
                            <li key={id}>{name}</li>
                        ))}
                    </ul>
                </Typography>
            </Box>
        </Modal>
    );
}
