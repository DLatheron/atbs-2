import { Button, Container } from "@mui/material";
import { useArmamentPage } from "./useArmamentPage";

export interface ArmamentPageProps {
    visible: boolean;
}

export function ArmamentPage({ visible }: ArmamentPageProps) {
    const { onEndArmamentPhase } = useArmamentPage();

    if (!visible) {
        return null;
    }

    return (
        <Container>
            <p>Armament Phase</p>
            <Button
                id="end-armament"
                title="End Armament"
                variant="contained"
                onClick={onEndArmamentPhase}
            >
                End Armament
            </Button>
        </Container>
    );
}
