"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import { BillingIssue } from "./types";

export function OverrideDialog({ issue, notes, busy, onNotesChange, onAuthorize, onClose }: {
  issue: BillingIssue | null; notes: string; busy: string;
  onNotesChange: (v: string) => void; onAuthorize: () => void; onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(issue)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Authorize Exception Override</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>{issue?.message}</Typography>
        <TextField fullWidth multiline rows={2} label="Override Notes (required)" value={notes} onChange={(e) => onNotesChange(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!notes.trim() || Boolean(busy)} onClick={onAuthorize}>Authorize</Button>
      </DialogActions>
    </Dialog>
  );
}
