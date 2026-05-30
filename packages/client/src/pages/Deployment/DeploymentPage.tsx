import { Button, Container } from "@mui/material";
import { useDeploymentPage } from "./useDeploymentPage";

export interface DeploymentPageProps {
    visible: boolean;
}

export function DeploymentPage({ visible }: DeploymentPageProps) {
    const { onEndDeploymentPhase } = useDeploymentPage();

    if (!visible) {
        return null;
    }

    return (
        <Container>
            <p>Deployment Phase</p>
            <Button
                id="end-deployment"
                title="End Deployment"
                variant="contained"
                onClick={onEndDeploymentPhase}
            >
                End Deployment
            </Button>
        </Container>
    );
}
