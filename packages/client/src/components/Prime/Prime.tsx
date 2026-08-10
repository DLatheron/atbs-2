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
    return (
        <Box data-testid="prime-component">
            <ToggleButtonGroup
                value={primed === "safe" ? "safe" : "primed"}
                onChange={(_event, value) => {
                    if (value === "safe") {
                        onPrime("immediate");
                    } else {
                        onPrime("safe");
                    }
                }}
                fullWidth
            >
                <ToggleButton
                    value="primed"
                    disabled={disabled}
                    sx={{ backgroundColor: "red", color: "white" }}
                >
                    <Typography variant="body1" sx={{ fontWeight: "semibold" }}>
                        Primed
                    </Typography>
                </ToggleButton>
                <ToggleButton
                    value="safe"
                    disabled={disabled}
                    sx={{ backgroundColor: "green", color: "white" }}
                >
                    <Typography variant="body1" sx={{ fontWeight: "semibold" }}>
                        Safe
                    </Typography>
                </ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}
