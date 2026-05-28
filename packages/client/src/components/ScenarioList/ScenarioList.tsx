import { JSX } from "react";
import { ScenarioId, ScenarioSummary } from "@atbs/shared-data";
import { Select } from "@mui/material";
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
    return (
        <Select value={selectedScenario} onChange={(e) => onScenarioChanged(e.target.value)}>
            {scenarios.map((scenario) => (
                <ScenarioComponent key={scenario.id} scenario={scenario} />
            ))}
        </Select>
    );
}
