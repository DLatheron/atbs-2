import { Fragment, JSX, useState } from "react";

import { Box, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from "@mui/material";
import { LobbyState } from "@atbs/shared-data";

export interface LobbyPageProps {
    initialClientName: string;
    lobbyState: LobbyState;
}

export function LobbyPage({ initialClientName, lobbyState }: LobbyPageProps): JSX.Element {
    const [clientName, setClientName] = useState<string>(initialClientName);

    return (
        <Stack>
            <TextField
                id="client-name"
                label="Client Name"
                variant="outlined"
                value={clientName}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setClientName(event.target.value);
                }}
            />

            {
                lobbyState && (
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{fontWeight: "bold"}}>Name</TableCell>
                                    <TableCell sx={{fontWeight: "bold"}}>ID</TableCell>
                                    <TableCell sx={{fontWeight: "bold"}}>Side</TableCell>
                                    <TableCell sx={{fontWeight: "bold"}}>Ready</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {
                                    lobbyState.clients.map(client => {
                                        return (
                                            <TableRow key={client.id}>
                                                <TableCell>{client.name}</TableCell>
                                                <TableCell>{client.id}</TableCell>
                                                <TableCell>{client.sideId}</TableCell>
                                                <TableCell>{client.ready}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                }
                            </TableBody>
                        </Table>
                    </TableContainer>
                )
            }
        </Stack>
    );
}
