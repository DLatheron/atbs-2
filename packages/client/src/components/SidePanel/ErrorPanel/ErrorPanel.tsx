import { useState, useEffect } from "react";
import { useInterval } from "../../../hooks";
import { ErrorType } from "@atbs/shared-data";
import { Container, Button, SxProps, Typography } from "@mui/material";
import { ERROR_MESSAGES } from "../../../helpers/formattingHelpers";

export interface ErrorPanelProps {
    error: ErrorType | null;
    timeout: number;
    onEndError: () => void;
    sx?: SxProps;
}

export function ErrorPanel({ error, timeout, onEndError, sx }: ErrorPanelProps) {
    const [counter, setCounter] = useState<number>(0);

    useEffect(() => {
        if (!error) {
            return;
        }

        setCounter(timeout / 1000 - 1);
    }, [error, timeout]);

    useInterval(
        () => {
            if (!error) {
                return;
            }

            setCounter(counter - 1);
            if (counter <= 0) {
                onEndError();
            }
        },
        error ? 1000 : undefined
    );

    if (!error) {
        return null;
    }

    const buttonTitle = `OK (${Math.max(counter, 0)})`;

    return (
        <Container
            data-testid="error-panel"
            disableGutters
            maxWidth={false}
            sx={{
                display: "grid",
                gridTemplateAreas: `
                    'error-info'
                    'exit-button'
                `,
                gridTemplateRows: "1fr auto",
                rowGap: 2,
                p: 1,
                ...sx
            }}
        >
            <Container
                disableGutters
                maxWidth={false}
                sx={{ gridArea: "error-info", overflow: "auto" }}
            >
                <Typography variant="h4" sx={{ textAlign: "center" }}>
                    {ERROR_MESSAGES[error]}
                </Typography>
            </Container>
            <Button
                id="end-error"
                title={buttonTitle}
                variant="outlined"
                onClick={onEndError}
                sx={{ gridArea: "exit-button" }}
            >
                {buttonTitle}
            </Button>
        </Container>
    );
}
