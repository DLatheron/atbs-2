import { JSX, useEffect, useState } from "react";

import {
    Button,
    Container,
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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { ClientId, GameId, LobbyState } from "@atbs/shared-data";

export interface LobbyPageProps {
    clientId: ClientId | undefined;
    initialClientName: string;
    gameId: GameId | undefined;

    onClientNameChanged: (clientName: string) => void;
    onGameIdChanged?: (gameId: GameId) => void;
    onCreateGame: () => void;
    onJoinGame: (gameId: GameId) => void;
    onLeaveGame: () => void;

    lobbyState: LobbyState | null;
}

export function LobbyPage({
    clientId,
    initialClientName,
    gameId,

    onClientNameChanged,
    onGameIdChanged,
    onCreateGame,
    onJoinGame,
    onLeaveGame,

    lobbyState
}: LobbyPageProps): JSX.Element {
    const [localGameId, setLocalGameId] = useState<GameId | undefined>(gameId);
    const tableHeadCellStyles = { fontWeight: "bold" };
    const connected = !!lobbyState;
    const canCreateGame = !connected;
    const canJoinGame = !connected && GameId.safeParse(localGameId).success;
    const canLeaveGame = connected;

    useEffect(() => {
        setLocalGameId(gameId);
    }, [gameId]);

    return (
        <Container component={Paper} maxWidth="xl" sx={{ padding: 4 }}>
            <Stack spacing={4}>
                <TextField
                    id="client-id"
                    label="Client ID"
                    variant="outlined"
                    value={clientId}
                    disabled
                />

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

                <Stack spacing={4} direction="row">
                    <Button
                        id="create-game"
                        title="Create a new game"
                        variant="contained"
                        disabled={!canCreateGame}
                        onClick={onCreateGame}
                    >
                        Create New Game
                    </Button>
                    <Button
                        id="join-game"
                        title="Join an existing game"
                        variant="contained"
                        disabled={!canJoinGame}
                        onClick={() => onJoinGame(GameId.parse(localGameId))}
                    >
                        Join Existing Game
                    </Button>
                    <Button
                        id="leave-game"
                        title="Leave the current game"
                        variant="outlined"
                        disabled={!canLeaveGame}
                        onClick={onLeaveGame}
                    >
                        Leave Current Game
                    </Button>
                </Stack>

                <Stack spacing={1} direction="row">
                    <TextField
                        id="game-id"
                        label="Game ID"
                        variant="outlined"
                        value={localGameId}
                        placeholder="ID of the game to join"
                        disabled={!onGameIdChanged}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setLocalGameId(e.target.value);
                        }}
                        onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === "Enter") {
                                const parsedGameId = GameId.safeParse(localGameId);
                                if (parsedGameId.success) {
                                    onGameIdChanged?.(parsedGameId.data);
                                }
                                e.preventDefault();
                            }
                        }}
                        onBlur={() => {
                            const parsedGameId = GameId.safeParse(localGameId);
                            if (parsedGameId.success) {
                                onGameIdChanged?.(parsedGameId.data);
                            }
                        }}
                    />
                    <Button
                        id="copy-game-id"
                        title="Copy Game Id to Clipboard"
                        disabled={!GameId.safeParse(localGameId).success}
                        onClick={() => {
                            const parsedGameId = GameId.safeParse(localGameId);
                            if (parsedGameId.success) {
                                navigator.clipboard
                                    .writeText(parsedGameId.data)
                                    .then(() =>
                                        console.info(`Copyied ${parsedGameId.data} to cliplboard`)
                                    )
                                    .catch((error) => console.error(error));
                            }
                        }}
                    >
                        <ContentCopyIcon />
                    </Button>
                </Stack>

                {connected ? (
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={tableHeadCellStyles}>Name</TableCell>
                                    <TableCell sx={tableHeadCellStyles}>ID</TableCell>
                                    <TableCell sx={tableHeadCellStyles}>Side</TableCell>
                                    <TableCell sx={tableHeadCellStyles}>Ready</TableCell>
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
                ) : (
                    <h2>No Game</h2>
                )}
            </Stack>
        </Container>
    );
}
