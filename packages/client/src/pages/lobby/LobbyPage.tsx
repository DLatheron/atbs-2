import { useLayoutEffect } from "react";

import {
    Button,
    Checkbox,
    Container,
    Grid,
    List,
    ListItem,
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

import { ClientId, GameId } from "@atbs/shared-data";
import { ScenarioComponent } from "../../components";
import { ScenarioListComponent } from "../../components/ScenarioList";
import { useLobbyPage } from "./useLobbyPage";

export interface LobbyPageProps {
    visible: boolean;
    clientId: ClientId | undefined;
    initialClientName: string;
    gameId: GameId | undefined;

    onClientNameChanged: (clientName: string) => void;
    onCreateGame: () => void;
    onJoinGame: (gameId: GameId) => void;
    onLeaveGame: () => void;
}

export function LobbyPage({
    visible,
    clientId,
    initialClientName,
    gameId,

    onClientNameChanged,
    onLeaveGame
}: LobbyPageProps) {
    const { lobbyState, logEntries, scenarios, onChangeSideId, onChangeReady, onChangeScenario } =
        useLobbyPage();

    const tableHeadCellStyles = { fontWeight: "bold" };
    const connected = !!lobbyState;
    const canLeaveGame = true;
    const isServer = lobbyState?.ownerId === clientId;
    const { scenario } = lobbyState ?? {};

    const availableSideIds = !scenario
        ? []
        : scenario.sides
              .map(({ id }) => id)
              .filter((id) => !lobbyState?.clients.find(({ sideId }) => sideId === id));

    useLayoutEffect(() => {
        document
            .getElementById("last-log-entry")
            ?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    });

    if (!visible) {
        return null;
    }

    return (
        <Container component={Paper} elevation={4} maxWidth="xl" sx={{ p: 2 }}>
            <Grid container spacing={3}>
                <Grid size={6} component={Paper} elevation={2} sx={{ p: 2 }}>
                    <Stack spacing={4}>
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
                                value={gameId}
                                disabled={true}
                            />
                            <Button
                                id="copy-game-id"
                                title="Copy Game Id to Clipboard"
                                disabled={!GameId.safeParse(gameId).success}
                                onClick={() => {
                                    const parsedGameId = GameId.safeParse(gameId);
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
                            <TableContainer component={Paper} elevation={3}>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={tableHeadCellStyles}>Name</TableCell>
                                            <TableCell sx={tableHeadCellStyles}>Side</TableCell>
                                            <TableCell sx={tableHeadCellStyles}>Ready</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {lobbyState.clients.map((client) => {
                                            return (
                                                <TableRow key={client.id}>
                                                    <TableCell>{client.name}</TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={
                                                                !client.sideId
                                                                    ? "None"
                                                                    : client.sideId
                                                            }
                                                            disabled={
                                                                (client.id !== clientId &&
                                                                    !isServer) ||
                                                                availableSideIds.length === 0
                                                            }
                                                            onChange={(e) =>
                                                                onChangeSideId(
                                                                    client.id,
                                                                    e.target.value
                                                                )
                                                            }
                                                        >
                                                            <MenuItem value="None">None</MenuItem>
                                                            {scenario?.sides.map((side) => (
                                                                <MenuItem
                                                                    key={side.id}
                                                                    value={side.id}
                                                                    disabled={
                                                                        !availableSideIds.includes(
                                                                            side.id
                                                                        )
                                                                    }
                                                                >
                                                                    {side.name}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={client.ready}
                                                            disabled={
                                                                client.id !== clientId ||
                                                                !client.sideId
                                                            }
                                                            onChange={(e) =>
                                                                onChangeReady(e.target.checked)
                                                            }
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
                                {logEntries.map(({ text }, index) => (
                                    <ListItem
                                        key={`${index}`}
                                        id={index === logEntries.length - 1 ? "last-log-entry" : ""}
                                    >
                                        <ListItemText primary={text} />
                                    </ListItem>
                                ))}
                            </List>
                        </Container>
                    </Stack>
                </Grid>
                <Grid size={6} component={Paper} elevation={2} sx={{ p: 2 }}>
                    {isServer ? (
                        scenarios && (
                            <ScenarioListComponent
                                scenarios={scenarios}
                                selectedScenario={lobbyState?.scenario?.id ?? null}
                                onScenarioChanged={onChangeScenario}
                            />
                        )
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
