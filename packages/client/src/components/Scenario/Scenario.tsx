import { ScenarioSummary } from "@atbs/shared-data";
import { Container, Typography } from "@mui/material";
import { DescriptionComponent } from "../Description/Description";
import { Fragment } from "react/jsx-runtime";

export interface ScenarioProps {
    scenario: ScenarioSummary;
}

export function ScenarioComponent({ scenario }: ScenarioProps) {
    return (
        <Container data-testid={scenario.id}>
            <Typography variant="h4" sx={{ pb: 2 }}>
                {scenario.name}
            </Typography>
            <DescriptionComponent description={scenario.description} />
            <Typography variant="h5" sx={{ pb: 2 }}>
                Sides
            </Typography>
            {scenario.sides.map((side) => (
                <Fragment key={side.id}>
                    <Typography variant="h6" sx={{ pb: 1 }}>
                        {side.name}
                    </Typography>
                    <DescriptionComponent description={side.description} />
                </Fragment>
            ))}
        </Container>
    );
}
