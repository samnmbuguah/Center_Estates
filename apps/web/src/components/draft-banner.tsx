"use client";

import React, { useMemo } from "react";
import { Alert, Box, Button, Typography, Stack, Chip } from "@mui/material";
import { Clock, Trash2, FileText } from "lucide-react";

export interface DraftBannerProps {
  restored: boolean;
  savedAt?: string | Date | null;
  hasFiles?: boolean;
  fileCount?: number;
  onDiscard?: () => void;
  message?: string;
}

function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? "s" : ""} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
}

export function DraftBanner({
  restored,
  savedAt,
  hasFiles = false,
  fileCount = 0,
  onDiscard,
  message,
}: DraftBannerProps) {
  const relativeTime = useMemo(() => formatRelativeTime(savedAt), [savedAt]);

  if (!restored) return null;

  const defaultMessage = message || "Your unsaved draft was restored automatically.";

  return (
    <Alert
      severity="info"
      icon={<Clock size={20} />}
      sx={{
        mb: 2,
        borderRadius: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        border: "1px solid",
        borderColor: "info.light",
        alignItems: "center",
      }}
      action={
        onDiscard ? (
          <Button
            color="inherit"
            size="small"
            startIcon={<Trash2 size={14} />}
            onClick={onDiscard}
            sx={{ fontWeight: 600, textTransform: "none" }}
          >
            Discard draft
          </Button>
        ) : undefined
      }
    >
      <Stack spacing={0.5}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {defaultMessage}
          </Typography>
          {relativeTime && (
            <Chip
              label={`Saved ${relativeTime}`}
              size="small"
              variant="outlined"
              color="info"
              sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
            />
          )}
        </Box>
        {hasFiles && (
          <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 13 }}>
            <FileText size={14} />
            For security, any attached files ({fileCount > 0 ? `${fileCount} file${fileCount > 1 ? "s" : ""}` : "documents"}) must be re-selected before saving.
          </Typography>
        )}
      </Stack>
    </Alert>
  );
}
