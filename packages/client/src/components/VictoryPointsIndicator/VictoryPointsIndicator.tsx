import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import type { VictoryObjectiveSummary } from "@atbs/shared-data";

const COUNT_UP_MS = 2000;
const AUTO_HIDE_MS = 5000;
const THROB_MS = 600;

export interface VictoryPointsIndicatorProps {
    victoryPoints: number | null | undefined;
    objectives?: VictoryObjectiveSummary[];
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

export function VictoryPointsIndicator({
    victoryPoints,
    objectives = []
}: VictoryPointsIndicatorProps) {
    const target = victoryPoints ?? 0;
    const [displayed, setDisplayed] = useState(target);
    const [open, setOpen] = useState(false);
    const [throbbing, setThrobbing] = useState(false);
    const prevTargetRef = useRef<number | null>(null);
    const autoHideTimerRef = useRef<number | null>(null);
    const pinOpenRef = useRef(false);
    const animFrameRef = useRef<number | null>(null);

    const clearAutoHide = useCallback(() => {
        if (autoHideTimerRef.current != null) {
            window.clearTimeout(autoHideTimerRef.current);
            autoHideTimerRef.current = null;
        }
    }, []);

    const scheduleAutoHide = useCallback(() => {
        clearAutoHide();
        autoHideTimerRef.current = window.setTimeout(() => {
            if (!pinOpenRef.current) {
                setOpen(false);
            }
            autoHideTimerRef.current = null;
        }, AUTO_HIDE_MS);
    }, [clearAutoHide]);

    useEffect(() => {
        if (prevTargetRef.current === null) {
            prevTargetRef.current = target;
            setDisplayed(target);
            return;
        }

        if (prevTargetRef.current === target) {
            return;
        }

        const from = displayed;
        const to = target;
        prevTargetRef.current = target;

        setThrobbing(true);
        const throbTimer = window.setTimeout(() => setThrobbing(false), THROB_MS);

        if (objectives.length > 0) {
            setOpen(true);
            scheduleAutoHide();
        }

        if (animFrameRef.current != null) {
            cancelAnimationFrame(animFrameRef.current);
        }

        const startedAt = performance.now();
        const tick = (now: number) => {
            const elapsed = now - startedAt;
            const t = Math.min(1, elapsed / COUNT_UP_MS);
            const value = from + (to - from) * easeOutCubic(t);
            setDisplayed(Math.round(value));
            if (t < 1) {
                animFrameRef.current = requestAnimationFrame(tick);
            } else {
                animFrameRef.current = null;
                setDisplayed(to);
            }
        };
        animFrameRef.current = requestAnimationFrame(tick);

        return () => {
            window.clearTimeout(throbTimer);
            if (animFrameRef.current != null) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
        // Intentionally only react to target / objectives length — not displayed mid-animation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, objectives.length, scheduleAutoHide]);

    useEffect(() => () => clearAutoHide(), [clearAutoHide]);

    const toggleOpen = () => {
        if (objectives.length === 0) {
            return;
        }
        setOpen((wasOpen) => {
            const next = !wasOpen;
            pinOpenRef.current = next;
            if (next) {
                clearAutoHide();
            }
            return next;
        });
    };

    const hasObjectives = objectives.length > 0;

    return (
        <Box
            sx={{
                gridArea: "vps",
                position: "relative",
                justifySelf: "center",
                alignSelf: "center",
                zIndex: 20
            }}
        >
            <Typography
                variant="body1"
                component="button"
                type="button"
                onClick={toggleOpen}
                aria-expanded={open}
                aria-haspopup="listbox"
                disabled={!hasObjectives}
                sx={{
                    m: 0,
                    p: 0.5,
                    border: "none",
                    background: "transparent",
                    color: throbbing ? "#ff6b2c" : "inherit",
                    cursor: hasObjectives ? "pointer" : "default",
                    font: "inherit",
                    transform: throbbing ? "scale(1.18)" : "scale(1)",
                    transition: `transform ${THROB_MS}ms ease, color ${THROB_MS}ms ease`,
                    whiteSpace: "nowrap",
                    userSelect: "none"
                }}
            >
                Victory Points: {victoryPoints == null ? "-" : displayed}
                {hasObjectives ? (open ? " ▾" : " ▸") : null}
            </Typography>

            {open && hasObjectives ? (
                <Paper
                    elevation={6}
                    role="listbox"
                    sx={{
                        position: "absolute",
                        top: "100%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        mt: 0.5,
                        minWidth: 220,
                        maxWidth: 360,
                        p: 1.25,
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider"
                    }}
                >
                    <Typography
                        variant="caption"
                        component="div"
                        sx={{ fontWeight: 700, mb: 0.5 }}
                    >
                        Objectives
                    </Typography>
                    {objectives.map((objective) => (
                        <Typography
                            key={objective.id}
                            variant="body2"
                            component="div"
                            sx={{
                                py: 0.25,
                                color: objective.complete ? "success.main" : "text.primary",
                                opacity: objective.complete ? 0.85 : 1
                            }}
                        >
                            {objective.complete ? "✓ " : "○ "}
                            {objective.name}
                        </Typography>
                    ))}
                </Paper>
            ) : null}
        </Box>
    );
}
