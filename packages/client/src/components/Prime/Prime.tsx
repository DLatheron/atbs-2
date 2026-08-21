import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import { Prime } from "@atbs/shared-data";
import Typography from "@mui/material/Typography";

export interface PrimeComponentProps {
    primed: Prime | undefined;
    disabled?: boolean;
    onPrime: (prime: Prime) => void;
}

export function PrimeComponent({ primed, disabled = false, onPrime }: PrimeComponentProps) {
    if (primed === undefined) {
        return null;
    }

    return (
        <Box data-testid="prime-component">
            <ToggleButtonGroup
                value={primed === "immediate" ? "immediate" : "safe"}
                onChange={(_event, value) => {
                    if (value === "safe" && primed !== "safe") {
                        onPrime("safe");
                    } else if (primed === "safe") {
                        onPrime("immediate");
                    }
                }}
                exclusive
                fullWidth
            >
                <ToggleButton
                    id="primed"
                    title="Primed"
                    value="immediate"
                    disabled={disabled}
                    sx={{
                        "&.MuiToggleButton-root.Mui-selected": {
                            backgroundColor: "red",
                            color: "white"
                        }
                    }}
                >
                    <Typography variant="body1" sx={{ fontWeight: "semibold" }}>
                        Primed
                    </Typography>
                </ToggleButton>
                <ToggleButton
                    id="safe"
                    title="Safe"
                    value="safe"
                    disabled={disabled}
                    sx={{
                        "&.MuiToggleButton-root.Mui-selected": {
                            backgroundColor: "green",
                            color: "white"
                        }
                    }}
                >
                    <Typography variant="body1" sx={{ fontWeight: "semibold" }}>
                        Safe
                    </Typography>
                </ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}
