import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

export type DefaultLoadoutMode = "replace" | "add";

export interface DefaultLoadoutDialogProps {
    open: boolean;
    /** When true, offer Replace / Add to; otherwise a simple confirm that replaces. */
    allowAdd: boolean;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm: (mode: DefaultLoadoutMode) => void;
}

export function DefaultLoadoutDialog({
    open,
    allowAdd,
    title,
    message,
    onClose,
    onConfirm
}: DefaultLoadoutDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Typography>{message}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                {allowAdd ? (
                    <>
                        <Button onClick={() => onConfirm("add")}>Add to</Button>
                        <Button variant="contained" onClick={() => onConfirm("replace")}>
                            Replace
                        </Button>
                    </>
                ) : (
                    <Button variant="contained" onClick={() => onConfirm("replace")}>
                        OK
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
