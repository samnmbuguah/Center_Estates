"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  Box,
  Alert,
  Chip,
  CircularProgress,
} from "@mui/material";
import { Bug, Send, CheckCircle2 } from "lucide-react";

export function DeveloperReportDialog({
  open,
  onClose,
  organizationId,
  username,
}: {
  open: boolean;
  onClose: () => void;
  organizationId?: string;
  username?: string;
}) {
  const pathname = usePathname();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("high");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successTicket, setSuccessTicket] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please describe the bug or system issue.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const payload = {
        title: title.trim() || `System Bug Report on ${pathname}`,
        message: description.trim(),
        priority,
        module: "platform",
        metadata: {
          route: pathname,
          reported_by: username,
          timestamp: new Date().toISOString(),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "SSR",
        },
      };

      const res = await apiFetch(
        "/companion/feedback/developer-report/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        organizationId,
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || "Failed to submit report to developer.");
      }

      const data = await res.json();
      setSuccessTicket(data.ticket_no || data.reference || "Submitted");
      setTitle("");
      setDescription("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setSuccessTicket(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: "var(--color-danger)15",
            color: "var(--color-danger)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Bug size={20} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 800 }}>
            Report System Bug / Developer Feedback
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Directly routed to Samuel N (Lead Platform Developer)
          </Typography>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {successTicket ? (
            <Alert
              icon={<CheckCircle2 size={22} />}
              severity="success"
              sx={{ py: 2, alignItems: "center" }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Developer Ticket Logged: {successTicket}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: 13, mt: 0.5 }}>
                Your bug report and technical diagnostic telemetry have been assigned to Samuel N.
              </Typography>
            </Alert>
          ) : (
            <>
              {error && <Alert severity="error">{error}</Alert>}

              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Active Route:
                </Typography>
                <Chip size="small" label={pathname} sx={{ fontFamily: "monospace", fontSize: 11 }} />
              </Box>

              <TextField
                label="Issue Summary / Title"
                placeholder="e.g. Invoicing calculation discrepancy or Button not responding"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                size="small"
              />

              <TextField
                label="Bug Description & Steps to Reproduce *"
                placeholder="Describe what happened, expected behavior, or error messages displayed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={4}
                required
              />

              <TextField
                select
                label="Severity / Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                fullWidth
                size="small"
              >
                <MenuItem value="low">Low (Cosmetic / Typo)</MenuItem>
                <MenuItem value="normal">Normal (Minor inconvenience)</MenuItem>
                <MenuItem value="high">High (Feature not working as expected)</MenuItem>
                <MenuItem value="urgent">Urgent (Critical blocker / Error 500)</MenuItem>
              </TextField>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          {successTicket ? (
            <Button onClick={handleClose} variant="contained" color="primary">
              Done
            </Button>
          ) : (
            <>
              <Button onClick={handleClose} disabled={loading} color="inherit">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="error"
                disabled={loading || !description.trim()}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
              >
                {loading ? "Submitting..." : "Send to Developer"}
              </Button>
            </>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
