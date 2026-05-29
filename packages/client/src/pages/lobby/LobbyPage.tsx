import { useCallback, useEffect, useLayoutEffect, useState } from "react";

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

import { ClientId, GameId, LobbyState, ScenarioSummary } from "@atbs/shared-data";
import { ScenarioComponent } from "../../components";
import { useServerMessageManager } from "../../hooks";
import { ScenarioListComponent } from "../../components/ScenarioList";

export interface LogEntry {
    text: string;
}

export interface LobbyPageProps {
    visible: boolean;
    clientId: ClientId | undefined;
    initialClientName: string;
    gameId: GameId | undefined;

    onClientNameChanged: (clientName: string) => void;
    onCreateGame: () => void;
    onJoinGame: (gameId: GameId) => void;
    onLeaveGame: () => void;

    logEntries: LogEntry[];
    addLogEntry: (logEntry: LogEntry) => void;
}

export function LobbyPage({
    visible,
    clientId,
    initialClientName,
    gameId,

    onClientNameChanged,
    onLeaveGame,

    logEntries,
    addLogEntry
}: LobbyPageProps) {
    const { messageManager, sendMessage } = useServerMessageManager();
    const [scenarios, setScenarios] = useState<ScenarioSummary[]>();
    const [lobbyState, setLobbyState] = useState<LobbyState>();

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
    console.info({ availableSideIds });

    const onChangeSideId = useCallback(
        (clientId: ClientId, selectedSideId: string) => {
            const sideId = selectedSideId === "None" ? null : selectedSideId;

            console.info("Change Side", clientId, sideId);

            sendMessage({
                type: "client:side:change",
                payload: { clientId, sideId }
            });
        },
        [sendMessage]
    );

    useEffect(() => {
        console.info("Mounting LobbyPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("lobby:state", (_context, payload) => {
                setLobbyState(payload);
            }),
            messageManager.registerHandler("lobby:client:renamed", (_context, payload) => {
                addLogEntry({
                    text: `🪪 Client '${payload.oldName}' renamed to '${payload.newName}'`
                });
            }),
            messageManager.registerHandler("lobby:client:side:changed", (_context, payload) => {
                console.info(`*** Client joined '${payload.newSide?.name ?? "null"}'`);
                if (payload.newSide && !payload.oldSide) {
                    addLogEntry({ text: `➡️ Client joined '${payload.newSide?.name}'` });
                } else if (payload.oldSide && !payload.newSide) {
                    addLogEntry({ text: `⬅️ Client left '${payload.oldSide?.name}'` });
                } else if (payload.oldSide && payload.newSide) {
                    addLogEntry({
                        text: `🔀 Client left '${payload.oldSide?.name}' and joined '${payload.newSide?.name}'`
                    });
                }
            }),
            messageManager.registerHandler("lobby:client:ready", (_context, payload) => {
                if (payload.ready) {
                    console.info(`*** Client ${payload.client.name} is ready!`);
                    addLogEntry({ text: `✅ Client '${payload.client.name} is ready!` });
                } else {
                    console.info(`*** Client ${payload.client.name} is not ready`);
                    addLogEntry({ text: `❌ Client '${payload.client.name} is not ready` });
                }
            }),
            messageManager.registerHandler("lobby:scenario:list", (_context, payload) => {
                console.info("Scenarios", payload.scenarios);
                setScenarios(payload.scenarios);
            })
        ];

        return () => {
            console.info("Unmounting LobbyPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, setLobbyState, addLogEntry]);

    useLayoutEffect(() => {
        document
            .getElementById("last-log-entry")
            ?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    });

    const onChangeReady = useCallback(
        (ready: boolean) => {
            sendMessage({
                type: "client:ready",
                payload: { ready }
            });
        },
        [sendMessage]
    );

    if (!visible) {
        return null;
    }

    return (
        <Container component={Paper} maxWidth="xl" sx={{ padding: 3 }}>
            <Grid container spacing={3} component={Paper}>
                <Grid size={6}>
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
                            <TableContainer component={Paper}>
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
                <Grid size={6}>
                    {isServer ? (
                        scenarios && (
                            <ScenarioListComponent
                                scenarios={scenarios}
                                selectedScenario={null}
                                onScenarioChanged={(selectedScenario) => {
                                    console.info(selectedScenario);
                                }}
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
