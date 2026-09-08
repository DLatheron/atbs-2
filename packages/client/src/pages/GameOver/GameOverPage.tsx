import { Box, IconButton, Paper, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { SideId, SideSummary, VictoryObjectiveSummary } from "@atbs/shared-data";

/** Delay after match end before the results screen appears (ms). */
export const GAME_OVER_DISPLAY_DELAY_MS = 5000;

export type GameOverOutcome = "won" | "lost" | "draw";

export interface GameOverResult {
    winners: SideId[];
    draw: boolean;
    outcome: GameOverOutcome;
    yourSideId: SideId | null;
    sides: SideSummary[];
}

export interface GameOverPageProps {
    visible: boolean;
    result: GameOverResult | null;
    onDismiss: () => void;
}

function outcomeTitle(outcome: GameOverOutcome): string {
    switch (outcome) {
        case "won":
            return "Won";
        case "lost":
            return "Lost";
        case "draw":
            return "Draw";
    }
}

function outcomeColor(outcome: GameOverOutcome): string {
    switch (outcome) {
        case "won":
            return "#2e7d32";
        case "lost":
            return "#c62828";
        case "draw":
            return "#ef6c00";
    }
}

export function GameOverPage({ visible, result, onDismiss }: GameOverPageProps) {
    if (!visible || !result) {
        return null;
    }

    const yourSide = result.sides.find((side) => side.id === result.yourSideId);

    return (
        <Box
            data-testid="game-over-page"
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(0, 0, 0, 0.72)",
                p: 2
            }}
        >
            <Paper
                elevation={8}
                sx={{
                    position: "relative",
                    width: "min(520px, 100%)",
                    p: 4,
                    pt: 5
                }}
            >
                <IconButton
                    aria-label="Close and return to main menu"
                    onClick={onDismiss}
                    sx={{ position: "absolute", top: 8, right: 8 }}
                >
                    <CloseIcon />
                </IconButton>

                <Stack spacing={3} sx={{ alignItems: "center" }}>
                    <Typography
                        variant="h2"
                        component="h1"
                        sx={{
                            fontWeight: 800,
                            letterSpacing: 2,
                            color: outcomeColor(result.outcome),
                            textTransform: "uppercase"
                        }}
                    >
                        {outcomeTitle(result.outcome)}
                    </Typography>

                    {yourSide ? (
                        <Typography variant="h6" color="text.secondary">
                            {yourSide.name} — {yourSide.victoryPoints} VP
                        </Typography>
                    ) : null}

                    <Box sx={{ width: "100%" }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                            Final standings
                        </Typography>
                        <Stack spacing={1}>
                            {result.sides.map((side, index) => {
                                const isYours = side.id === result.yourSideId;
                                const isWinner = result.winners.includes(side.id);
                                return (
                                    <Box
                                        key={side.id}
                                        sx={{
                                            display: "grid",
                                            gridTemplateColumns: "32px 1fr auto",
                                            gap: 1,
                                            alignItems: "center",
                                            px: 1.5,
                                            py: 1,
                                            borderRadius: 1,
                                            bgcolor: isYours ? "action.selected" : "action.hover",
                                            border: isWinner
                                                ? "1px solid"
                                                : "1px solid transparent",
                                            borderColor: isWinner ? "success.main" : "transparent"
                                        }}
                                    >
                                        <Typography variant="body2" color="text.secondary">
                                            #{index + 1}
                                        </Typography>
                                        <Typography
                                            variant="body1"
                                            sx={{ fontWeight: isYours ? 700 : 500 }}
                                        >
                                            {side.name}
                                            {isYours ? " (you)" : ""}
                                            {isWinner && !result.draw ? " ★" : ""}
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                            {side.victoryPoints} VP
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Box>

                    {yourSide?.objectives && yourSide.objectives.length > 0 ? (
                        <Box sx={{ width: "100%" }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                                Your objectives
                            </Typography>
                            <Stack spacing={0.5}>
                                {yourSide.objectives.map((objective: VictoryObjectiveSummary) => (
                                    <Typography key={objective.id} variant="body2">
                                        {objective.complete ? "✓ " : "○ "}
                                        {objective.name}
                                    </Typography>
                                ))}
                            </Stack>
                        </Box>
                    ) : null}
                </Stack>
            </Paper>
        </Box>
    );
}
