import { JSX, useCallback, useEffect, useLayoutEffect, useState } from "react";

import {
    Button,
    Checkbox,
    Container,
    Grid,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    MenuItem,
    Paper,
    Select,
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
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import EditIcon from "@mui/icons-material/Edit";
import GroupIcon from "@mui/icons-material/Group";

import { ClientId, GameId, LobbyState, SideId } from "@atbs/shared-data";
import { ScenarioComponent } from "../../components";

const SHOW_ID = true; // Temporary Hack.
export interface LogEntry {
    text: string;
}

export interface LobbyPageProps {
    clientId: ClientId | undefined;
    initialClientName: string;
    gameId: GameId | undefined;

    onClientNameChanged: (clientName: string) => void;
    onGameIdChanged?: (gameId: GameId) => void;
    onCreateGame: () => void;
    onJoinGame: (gameId: GameId) => void;
    onLeaveGame: () => void;
    onSideIdChange: (clientId: ClientId, sideId: SideId | null) => void;
    onReadyChange: (ready: boolean) => void;

    logEntries: LogEntry[];
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
    onSideIdChange,
    onReadyChange,

    logEntries,
    lobbyState
}: LobbyPageProps): JSX.Element {
    const [localGameId, setLocalGameId] = useState<GameId | undefined>(gameId);
    const tableHeadCellStyles = { fontWeight: "bold" };
    const connected = !!lobbyState;
    const canCreateGame = !connected;
    const canJoinGame = !connected && GameId.safeParse(localGameId).success;
    const canLeaveGame = connected;
    const isServer = lobbyState?.ownerId === clientId;
    const { scenario } = lobbyState ?? {};

    const availableSideIds = (
        !scenario
            ? []
            : scenario.sides
                .map(({ id }) => id)
                .filter((id) => !lobbyState?.clients.find(({ sideId }) => sideId === id))
    );
    console.info({ availableSideIds });

    const onSideIdHandler = useCallback((clientId: ClientId, selectedSideId: string) => {
        const sideId = selectedSideId === "None" ? null : selectedSideId;

        onSideIdChange(clientId, sideId);
    }, [onSideIdChange]);

    useEffect(() => {
        setLocalGameId(gameId);
    }, [gameId]);

    useLayoutEffect(() => {
        document
            .getElementById("last-log-entry")
            ?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    });

    return (
        <Container component={Paper} maxWidth="xl" sx={{ padding: 3 }}>
            <Grid container spacing={3} component={Paper}>
                <Grid size={6}>
                    <Stack spacing={4}>
                        {SHOW_ID && (
                            <TextField
                                id="client-id"
                                label="Client ID"
                                variant="outlined"
                                value={clientId}
                                disabled
                            />
                        )}

                        <TextField
                            id="client-name"
                            label="Client Name"
                            variant="outlined"
                            defaultValue={initialClientName}
                            placeholder="Name of this client"
                            onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === "Enter") {
                                    onClientNameChanged(
                                        (e.target as unknown as { value: string }).value
                                    );
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
                                                console.info(
                                                    `Copyied ${parsedGameId.data} to cliplboard`
                                                )
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
                                            {SHOW_ID && (
                                                <TableCell sx={tableHeadCellStyles}>ID</TableCell>
                                            )}
                                            <TableCell sx={tableHeadCellStyles}>Side</TableCell>
                                            <TableCell sx={tableHeadCellStyles}>Ready</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {lobbyState.clients.map((client) => {
                                            return (
                                                <TableRow key={client.id}>
                                                    <TableCell>{client.name}</TableCell>
                                                    {SHOW_ID && <TableCell>{client.id}</TableCell>}
                                                    <TableCell>
                                                        <Select
                                                            labelId="demo-simple-select-label"
                                                            id="demo-simple-select"
                                                            value={
                                                                !client.sideId
                                                                    ? "None"
                                                                    : client.sideId
                                                            }
                                                            disabled={client.id !== clientId && !isServer}
                                                            onChange={(e) =>
                                                                onSideIdHandler(client.id, e.target.value)
                                                            }
                                                        >
                                                            <MenuItem value="None">None</MenuItem>
                                                                {
                                                                    scenario?.sides.map((side) => (
                                                                        <MenuItem
                                                                            value={side.id}
                                                                            disabled={!availableSideIds.includes(side.id)}
                                                                        >
                                                                            {side.name}
                                                                        </MenuItem>
                                                                    ))
                                                                }
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={client.ready}
                                                            disabled={client.id !== clientId || !client.sideId}
                                                            onChange={e => {
                                                                onReadyChange(e.target.checked)
                                                            }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <h2>No Game</h2>
                        )}

                        <Container
                            component={Paper}
                            disableGutters
                            maxWidth="xl"
                            elevation={1}
                            sx={{ height: 400, maxHeight: 400, overflow: "auto" }}
                        >
                            <List
                                dense
                                id="log"
                                subheader={<ListSubheader component="div">Logs</ListSubheader>}
                            >
                                {
                                    logEntries.map(({ text }, index) => (
                                        <ListItem
                                            id={
                                                index === logEntries.length - 1
                                                    ? "last-log-entry"
                                                    : ""
                                            }
                                        >
                                            <ListItemText primary={text} />
                                        </ListItem>
                                    ))
                                }
                            </List>
                        </Container>
                    </Stack>
                </Grid>
                <Grid size={6}>
                    {isServer ? (
                        <h1>Server</h1>
                    ) : scenario ? (
                        <ScenarioComponent scenario={scenario} />
                    ) : (
                        <p>No scenario selected</p>
                    )}
                </Grid>
            </Grid>
        </Container>
    );
}
