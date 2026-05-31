import { Container } from "@mui/material";

export interface TurnPageProps {
    visible: boolean;
}

export function TurnsPage({ visible }: TurnPageProps) {
    // const { onTurnPage } = useTurnsPage();

    if (!visible) {
        return null;
    }

    return (
        <Container>
            <p>Turn Phase</p>
        </Container>
    );
}
