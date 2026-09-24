"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Divider,
  IconButton,
} from "@mui/material";
import {
  Building2,
  ArrowRight,
  ArrowLeftRight,
  X,
  CheckCircle2,
  Layers,
} from "lucide-react";
import type { PropertyContextValue } from "@/lib/property-context";
import { modules, type ErpModule } from "@/lib/modules";

interface SwitchPropertyModalProps {
  open: boolean;
  targetModuleSlug: string | null;
  activeProperty: PropertyContextValue | null;
  properties: PropertyContextValue[];
  onClose: () => void;
  onContinueCurrent: () => void;
  onSwitchProperty: (selected: PropertyContextValue) => void;
}

const STORAGE_KEY = "ce_skip_module_property_dialog";

export default function SwitchPropertyModal({
  open,
  targetModuleSlug,
  activeProperty,
  properties,
  onClose,
  onContinueCurrent,
  onSwitchProperty,
}: SwitchPropertyModalProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [skipDialog, setSkipDialog] = useState<boolean>(false);

  // Sync preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSkipDialog(localStorage.getItem(STORAGE_KEY) === "true");
    }
  }, [open]);

  // Set default selection to first different property or current property
  useEffect(() => {
    if (open) {
      if (activeProperty) {
        setSelectedPropertyId(activeProperty.id);
      } else if (properties.length > 0) {
        setSelectedPropertyId(properties[0].id);
      }
    }
  }, [open, activeProperty, properties]);

  const targetModule: ErpModule | undefined = useMemo(
    () => modules.find((m) => m.slug === targetModuleSlug),
    [targetModuleSlug]
  );

  const handleSkipToggle = (checked: boolean) => {
    setSkipDialog(checked);
    if (typeof window !== "undefined") {
      if (checked) {
        localStorage.setItem(STORAGE_KEY, "true");
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const handleSwitchSubmit = () => {
    const chosen = properties.find((p) => p.id === selectedPropertyId);
    if (chosen) {
      onSwitchProperty(chosen);
    }
  };

  const isSwitchingProperty = selectedPropertyId !== activeProperty?.id;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(15, 23, 42, 0.25)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
          },
        },
      }}
    >
      {/* Header with blue accent bar */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)",
          color: "#ffffff",
          px: 3,
          py: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={20} color="#ffffff" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
              {targetModule ? `Opening ${targetModule.name}` : "Switch Active Property"}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.8)", fontSize: 12 }}>
              {targetModule
                ? "Choose how you want to proceed into this module"
                : "Select the property to focus on across all workflows"}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255, 255, 255, 0.8)", "&:hover": { color: "#ffffff" } }}>
          <X size={18} />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {/* Current Active Property Info Card */}
        {activeProperty && (
          <Box
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: 2,
              background: "rgba(37, 99, 235, 0.06)",
              border: "1px solid rgba(37, 99, 235, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10 }}>
                Current Active Property
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary" }}>
                {activeProperty.name}
              </Typography>
              {activeProperty.location && (
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  {activeProperty.location}
                </Typography>
              )}
            </Box>
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 1.5,
                background: "rgba(16, 185, 129, 0.12)",
                color: "#059669",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              <CheckCircle2 size={13} />
              <span>In Focus</span>
            </Box>
          </Box>
        )}

        {/* Action Option 1: Continue on current property (Only shown when switching modules) */}
        {targetModule && activeProperty && (
          <Box sx={{ mb: 2.5 }}>
            <button
              type="button"
              onClick={onContinueCurrent}
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: 12,
                border: "1.5px solid #2563eb",
                background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(30, 58, 138, 0.04) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.18s ease-in-out",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(30, 58, 138, 0.08) 100%)";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(30, 58, 138, 0.04) 100%)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 800, color: "#1d4ed8", fontSize: 14 }}>
                  Continue on {activeProperty.name}
                </Typography>
                <Typography sx={{ color: "text.secondary", fontSize: 12, mt: 0.2 }}>
                  Open {targetModule.name} using this property
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#2563eb",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowRight size={16} />
              </Box>
            </button>

            <Divider sx={{ my: 2.5, "&::before, &::after": { borderColor: "divider" } }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, fontSize: 11 }}>
                OR SWITCH PROPERTY
              </Typography>
            </Divider>
          </Box>
        )}

        {/* Action Option 2: Select a different property */}
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", mb: 1 }}>
            {targetModule ? "Select a different property:" : "Choose active property:"}
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel id="property-select-modal-label">Property</InputLabel>
            <Select
              labelId="property-select-modal-label"
              id="property-select-modal"
              value={selectedPropertyId}
              label="Property"
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              {properties.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <span style={{ fontWeight: p.id === activeProperty?.id ? 800 : 500 }}>
                      {p.name}
                    </span>
                    {p.id === activeProperty?.id && (
                      <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, marginLeft: 8 }}>
                        (Current)
                      </span>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Preference Checkbox: Don't show each time */}
        <Box sx={{ mt: 3, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={skipDialog}
                onChange={(e) => handleSkipToggle(e.target.checked)}
                size="small"
                color="primary"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontSize: 13, color: "text.secondary" }}>
                {targetModule
                  ? "Don't show this dialog each time (always continue with current property)"
                  : "Skip confirmation dialog when switching modules"}
              </Typography>
            }
          />
          <Typography variant="caption" sx={{ color: "text.disabled", display: "block", ml: 3.8, mt: -0.5 }}>
            You can always switch properties using the blue sidebar icon.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, justifyContent: "space-between" }}>
        <Button onClick={onClose} variant="outlined" color="inherit" sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          onClick={handleSwitchSubmit}
          variant="contained"
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 700,
            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
            px: 2.5,
          }}
        >
          {targetModule
            ? isSwitchingProperty
              ? `Switch & Open ${targetModule.name}`
              : `Open ${targetModule.name}`
            : "Set Active Property"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
