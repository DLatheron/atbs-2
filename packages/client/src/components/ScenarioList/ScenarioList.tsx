import { JSX, useState } from "react";
import { ScenarioId, ScenarioSummary } from "@atbs/shared-data";
import { List, ListItemButton, ListItemText, Stack } from "@mui/material";
import { ScenarioComponent } from "../Scenario/Scenario";

export interface ScenarioListProps {
    scenarios: ScenarioSummary[];
    selectedScenario: ScenarioId | null;

    onScenarioChanged: (selectedScenario: ScenarioId | null) => void;
}

export function ScenarioListComponent({
    scenarios,
    selectedScenario,

    onScenarioChanged
}: ScenarioListProps): JSX.Element {
    const [selectedIndex, setSelectedIndex] = useState(0);

    return (
        <Stack spacing={3}>
            <List>
                {scenarios.map((scenario, index) =>
                    <ListItemButton key={scenario.id} selected={selectedIndex === index} onClick={() => setSelectedIndex(index)}>
                        <ListItemText primary={scenario.name} />
                    </ListItemButton>
                )}
            </List>
            <ScenarioComponent scenario={scenarios[selectedIndex]} />
        </Stack>
    );
}
