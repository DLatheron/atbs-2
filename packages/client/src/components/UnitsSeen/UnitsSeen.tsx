import { useState, useEffect } from "react";

import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import { SxProps } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

export interface UnitsSeenComponentProps {
    numSeenUnits: number;
    sx?: SxProps;
}

export function UnitsSeenComponent({ numSeenUnits, sx }: UnitsSeenComponentProps) {
    const [seen, setSeen] = useState<number>(numSeenUnits);
    const [visible, setVisible] = useState<boolean>(false);

    useEffect(() => {
        if (numSeenUnits > 0) {
            setSeen(numSeenUnits);
            setVisible(true);
        } else {
            setVisible(false);
        }
    }, [numSeenUnits]);

    return (
        <Box data-testid="units-seen-component" sx={{ m: 0, p: 0 }}>
            <Collapse in={visible}>
                <Box
                    sx={{
                        borderRadius: 2,
                        border: "1px black solid",
                        backgroundColor: "red",
                        color: "yellow",
                        rowGap: 1,
                        p: 1,
                        textAlign: "center",
                        ...sx
                    }}
                >
                    <Typography variant="h5">{`${seen} ${seen === 1 ? "Enemy" : "Enemies"} Seen`}</Typography>
                </Box>
            </Collapse>
        </Box>
    );
}
