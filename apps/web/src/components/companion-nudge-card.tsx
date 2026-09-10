"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Typography, Button, IconButton, Paper, Chip } from "@mui/material";
import { X, Sparkles, ArrowRight, Heart } from "lucide-react";

export type NudgeData = {
  id: string;
  category: "wellness" | "workload" | "productivity" | "planning";
  icon: string;
  title: string;
  message: string;
  action_label?: string;
  action_href?: string;
  urgency?: "low" | "medium" | "high";
};

export function CompanionNudgeCard({
  nudge,
  onDismiss,
}: {
  nudge: NudgeData | null;
  onDismiss?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (!nudge || dismissed) return null;

  const isWellness = nudge.category === "wellness";
  const bgGradient = isWellness
    ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)"
    : nudge.category === "productivity"
    ? "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)"
    : "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(234, 88, 12, 0.08) 100%)";

  const borderColor = isWellness
    ? "rgba(16, 185, 129, 0.3)"
    : nudge.category === "productivity"
    ? "rgba(99, 102, 241, 0.3)"
    : "rgba(245, 158, 11, 0.3)";

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        background: bgGradient,
        border: "1px solid",
        borderColor: borderColor,
        display: "flex",
        alignItems: "flex-start",
        gap: 2,
        position: "relative",
        transition: "all 0.2s ease",
      }}
    >
      <Box
        sx={{
          fontSize: 26,
          lineHeight: 1,
          width: 44,
          height: 44,
          borderRadius: 2.5,
          bgcolor: "background.paper",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          flexShrink: 0,
        }}
      >
        {nudge.icon}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "text.primary" }}>
            {nudge.title}
          </Typography>
          <Chip
            size="small"
            label="Quiet Companion"
            icon={<Sparkles size={12} />}
            sx={{
              height: 20,
              fontSize: "0.7rem",
              fontWeight: 700,
              bgcolor: "background.paper",
              color: "text.secondary",
            }}
          />
        </Box>

        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.55, mb: 1.5 }}>
          {nudge.message}
        </Typography>

        {nudge.action_label && nudge.action_href && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              component={Link}
              href={nudge.action_href}
              size="small"
              variant="contained"
              endIcon={<ArrowRight size={14} />}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.8rem",
                px: 1.75,
                py: 0.5,
                boxShadow: "none",
                bgcolor: isWellness ? "var(--color-emerald-strong)" : "var(--color-indigo)",
                "&:hover": {
                  bgcolor: isWellness ? "var(--color-emerald-deep)" : "#4338ca",
                  boxShadow: "none",
                },
              }}
            >
              {nudge.action_label}
            </Button>
            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={() => {
                setDismissed(true);
                onDismiss?.();
              }}
              sx={{
                textTransform: "none",
                fontSize: "0.78rem",
                color: "text.secondary",
              }}
            >
              Dismiss
            </Button>
          </Box>
        )}
      </Box>

      <IconButton
        size="small"
        aria-label="Dismiss nudge"
        onClick={() => {
          setDismissed(true);
          onDismiss?.();
        }}
        sx={{
          color: "text.secondary",
          position: "absolute",
          top: 10,
          right: 10,
        }}
      >
        <X size={16} />
      </IconButton>
    </Paper>
  );
}
