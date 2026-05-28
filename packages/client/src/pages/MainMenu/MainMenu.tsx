import { GameId } from "@atbs/shared-data";
import { Box, Button, Container, Paper, Stack, TextField } from "@mui/material";
import { useState } from "react";

export interface MainMenuPageProps {
    visible: boolean;
    defaultGameId: GameId | undefined;

    onCreateGame: () => void;
    onJoinGame: (gameId: GameId) => void;
}

export function MainMenuPage({
    visible,
    defaultGameId,

    onCreateGame,
    onJoinGame
}: MainMenuPageProps) {
    const [gameId, setGameId] = useState<GameId | undefined>(defaultGameId ?? "");
    const canCreateGame = true;
    const canJoinGame = GameId.safeParse(gameId).success;

    if (!visible) {
        return null;
    }

    return (
        <Container component={Paper} maxWidth="sm" sx={{ padding: 3 }}>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                }}
            >
                <Stack spacing={3}>
                    <TextField
                        id="game-id"
                        label="Game ID"
                        variant="outlined"
                        value={gameId}
                        placeholder="ID of the game to join"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setGameId(e.target.value);
                        }}
                    />

                    <Stack spacing={4} direction="row" sx={{ justifyContent: "center" }}>
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
                            onClick={() => onJoinGame(GameId.parse(gameId))}
                        >
                            Join Existing Game
                        </Button>
                    </Stack>
                </Stack>
            </Box>
        </Container>
    );
}
