import type { Description } from "@atbs/shared-data";
import { Typography } from "@mui/material";

export interface DescriptionComponentProps {
    description: Description;
}

export function DescriptionComponent({ description }: DescriptionComponentProps) {
    return (
        description.map((entry, index) => {
            if ("h1" in entry) {
                return <Typography key={index} variant="h4">{entry.h1}</Typography>;
            }
            if ("h2" in entry) {
                return <Typography key={index} variant="h5">{entry.h2}</Typography>;
            }
            if ("h3" in entry) {
                return <Typography key={index} variant="h6">{entry.h3}</Typography>;
            }
            if ("text" in entry) {
                return (
                    <Typography
                        key={index}
                        variant="body1"
                        sx={{ pb: entry.pb }}
                    >
                        {entry.text}
                    </Typography>
                );
            }
            if ("line" in entry) {
                return <hr/>
            }
            throw new Error(`Unexpected description element: ${JSON.stringify(entry)}`);
        })
    );
}
