import { JSX, useEffect, useState } from "react";
import { ScenarioId, ScenarioSummary } from "@atbs/shared-data";
import { List, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { ScenarioComponent } from "../Scenario/Scenario";
export interface ScenarioListProps {
    scenarios: ScenarioSummary[];
    selectedScenario: ScenarioId | null;

    onScenarioChanged: (selectedScenario: ScenarioId | null) => void;
}

export function ScenarioListComponent({
    scenarios,
    selectedScenario: selectedScenarioId,

    onScenarioChanged
}: ScenarioListProps): JSX.Element {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectedScenarioIndex = scenarios.findIndex(({ id }) => selectedScenarioId === id);

    useEffect(() => {
        const index = scenarios.findIndex(({ id }) => selectedScenarioId === id);

        setSelectedIndex(index >= 0 ? index : 0);
    }, [selectedScenarioId, scenarios]);

    return (
        <Stack spacing={3}>
            <List>
                {scenarios.map((scenario, index) => (
                    <ListItem key={scenario.id} disablePadding>
                        <ListItemButton
                            selected={selectedIndex === index}
                            disableRipple
                            onClick={() => setSelectedIndex(index)}
                            onDoubleClick={() => onScenarioChanged(scenarios[index].id)}
                        >
                            <ListItemIcon>
                                {selectedScenarioIndex === index && <CheckCircleIcon />}
                            </ListItemIcon>
                            <ListItemText primary={scenario.name} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            <ScenarioComponent scenario={scenarios[selectedIndex]} />
        </Stack>
    );
}
