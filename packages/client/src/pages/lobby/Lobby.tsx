import { JSX } from "react";

import {
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField
} from "@mui/material";
import { LobbyState } from "@atbs/shared-data";

export interface LobbyPageProps {
    initialClientName: string;
    onClientNameChanged: (clientName: string) => void;

    lobbyState: LobbyState | null;
}

export function LobbyPage({
    initialClientName,
    onClientNameChanged,
    lobbyState
}: LobbyPageProps): JSX.Element {
    return (
        <Stack>
            <TextField
                id="client-name"
                label="Client Name"
                variant="outlined"
                defaultValue={initialClientName}
                placeholder="Name of this client"
                onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                        onClientNameChanged((e.target as unknown as { value: string }).value);
                        e.preventDefault();
                    }
                }}
                onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                    onClientNameChanged(e.target.value);
                }}
            />

            {lobbyState && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>ID</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Side</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Ready</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {lobbyState.clients.map((client) => {
                                return (
                                    <TableRow key={client.id}>
                                        <TableCell>{client.name}</TableCell>
                                        <TableCell>{client.id}</TableCell>
                                        <TableCell>{client.sideId}</TableCell>
                                        <TableCell>{client.ready}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Stack>
    );
}
