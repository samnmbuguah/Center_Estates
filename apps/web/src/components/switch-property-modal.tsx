"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  TextField,
  Fade,
} from "@mui/material";
import {
  Building2,
  ArrowRight,
  X,
  CheckCircle2,
  Search,
  MapPin,
  Sparkles,
  Layers,
  Check,
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [skipDialog, setSkipDialog] = useState<boolean>(false);

  // Sync preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSkipDialog(localStorage.getItem(STORAGE_KEY) === "true");
    }
  }, [open]);

  // Set default selection
  useEffect(() => {
    if (open) {
      setSearchQuery("");
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

  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return properties;
    const q = searchQuery.toLowerCase();
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q))
    );
  }, [properties, searchQuery]);

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
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width: "100%",
            maxWidth: "460px !important",
            m: { xs: 1.5, sm: 2 },
            borderRadius: "18px",
            overflow: "hidden",
            boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(59, 130, 246, 0.2)",
            background: "var(--bg-surface, #ffffff)",
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {/* Premium Gradient Header */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #0b192c 0%, #17386d 40%, #1e40af 80%, #2563eb 100%)",
          color: "#ffffff",
          px: 3,
          py: 2.2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.16)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
          >
            <Building2 size={20} color="#ffffff" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
              {targetModule ? `Opening ${targetModule.name}` : "Switch Active Property"}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(224, 242, 254, 0.85)", fontSize: 11, display: "block" }}>
              {targetModule
                ? "Select property context for this module"
                : "Choose the property to focus on across all workflows"}
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: "rgba(255, 255, 255, 0.8)",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "50%",
            p: 0.7,
            "&:hover": { background: "rgba(255, 255, 255, 0.25)", color: "#ffffff" },
          }}
        >
          <X size={16} />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 2.5, overflowY: "auto" }}>
        {/* Fast Action: Continue on current property (Only shown when switching modules) */}
        {targetModule && activeProperty && (
          <Box sx={{ mb: 2 }}>
            <button
              type="button"
              onClick={onContinueCurrent}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "14px",
                border: "1.5px solid #3b82f6",
                background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.18s ease-in-out",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(37, 99, 235, 0.14) 0%, rgba(59, 130, 246, 0.07) 100%)";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(37, 99, 235, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(37, 99, 235, 0.08)";
              }}
            >
              <Box sx={{ pr: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontWeight: 800, color: "#1e40af", fontSize: 13.5 }}>
                    Continue with {activeProperty.name}
                  </Typography>
                  <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                    Current
                  </span>
                </Box>
                <Typography sx={{ color: "text.secondary", fontSize: 11.5, mt: 0.2 }}>
                  Proceed directly to {targetModule.name}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "#2563eb",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.4)",
                }}
              >
                <ArrowRight size={15} />
              </Box>
            </button>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, my: 2 }}>
              <Box sx={{ flex: 1, height: "1px", background: "var(--border-color, #e2e8f0)" }} />
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Or select another property
              </Typography>
              <Box sx={{ flex: 1, height: "1px", background: "var(--border-color, #e2e8f0)" }} />
            </Box>
          </Box>
        )}

        {/* Current Active Property Mini-Banner (when in direct property switcher mode) */}
        {!targetModule && activeProperty && (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: "12px",
              background: "rgba(37, 99, 235, 0.05)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Active in workspace
              </Typography>
              <Typography sx={{ fontWeight: 800, color: "text.primary", fontSize: 13 }}>
                {activeProperty.name}
              </Typography>
            </Box>
            <span style={{ fontSize: 10.5, background: "rgba(16, 185, 129, 0.15)", color: "#059669", padding: "2px 8px", borderRadius: 6, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
              <Check size={11} strokeWidth={3} /> In Focus
            </span>
          </Box>
        )}

        {/* Search Input (if > 3 properties) */}
        {properties.length > 3 && (
          <Box sx={{ mb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search properties by name or location…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={15} color="#94a3b8" />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: "10px",
                    fontSize: 12.5,
                    height: 38,
                    background: "var(--bg-app, #f8fafc)",
                  },
                },
              }}
            />
          </Box>
        )}

        {/* Scrollable List of Interactive Property Cards */}
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: 10.5, letterSpacing: "0.05em", mb: 1, display: "block" }}>
          Available Properties ({filteredProperties.length})
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            maxHeight: 220,
            overflowY: "auto",
            pr: 0.5,
            "&::-webkit-scrollbar": { width: 5 },
            "&::-webkit-scrollbar-thumb": { background: "rgba(0,0,0,0.15)", borderRadius: 4 },
          }}
        >
          {filteredProperties.length === 0 ? (
            <Box sx={{ py: 3, textAlign: "center", color: "text.secondary", fontSize: 12 }}>
              No properties found matching &ldquo;{searchQuery}&rdquo;
            </Box>
          ) : (
            filteredProperties.map((p) => {
              const isSelected = p.id === selectedPropertyId;
              const isCurrent = p.id === activeProperty?.id;

              return (
                <Box
                  key={p.id}
                  onClick={() => setSelectedPropertyId(p.id)}
                  sx={{
                    p: 1.4,
                    borderRadius: "12px",
                    border: isSelected
                      ? "1.5px solid #2563eb"
                      : "1px solid var(--border-color, #e2e8f0)",
                    background: isSelected
                      ? "rgba(37, 99, 235, 0.08)"
                      : "var(--bg-surface, #ffffff)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 2px 8px rgba(37, 99, 235, 0.15)" : "none",
                    "&:hover": {
                      borderColor: isSelected ? "#2563eb" : "rgba(37, 99, 235, 0.4)",
                      background: isSelected ? "rgba(37, 99, 235, 0.1)" : "rgba(37, 99, 235, 0.03)",
                    },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, minWidth: 0, flex: 1 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        background: isSelected ? "#2563eb" : "rgba(15, 23, 42, 0.06)",
                        color: isSelected ? "#ffffff" : "#475569",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Building2 size={16} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                        <Typography
                          sx={{
                            fontWeight: isSelected ? 800 : 650,
                            fontSize: 13,
                            color: isSelected ? "#1e40af" : "text.primary",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.name}
                        </Typography>
                        {isCurrent && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              color: "#059669",
                              background: "rgba(16, 185, 129, 0.12)",
                              padding: "1px 5px",
                              borderRadius: 4,
                            }}
                          >
                            Active
                          </span>
                        )}
                      </Box>
                      {p.location && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, mt: 0.2 }}>
                          <MapPin size={10} color="#94a3b8" />
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontSize: 11,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "block",
                            }}
                          >
                            {p.location}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* Radio / Selection Indicator */}
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: isSelected ? "2px solid #2563eb" : "2px solid #cbd5e1",
                      background: isSelected ? "#2563eb" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      ml: 1,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {/* Preference Checkbox: Remember choice */}
        <Box sx={{ mt: 2.2, pt: 1.5, borderTop: "1px solid var(--border-color, #f1f5f9)" }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={skipDialog}
                onChange={(e) => handleSkipToggle(e.target.checked)}
                size="small"
                sx={{
                  color: "#94a3b8",
                  "&.Mui-checked": { color: "#2563eb" },
                  p: 0.6,
                  mr: 0.8,
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontSize: 12, color: "text.secondary", fontWeight: 550, lineHeight: 1.3 }}>
                Don&rsquo;t show this confirmation each time when switching modules
              </Typography>
            }
            sx={{ m: 0 }}
          />
          <Typography variant="caption" sx={{ color: "text.disabled", display: "block", ml: 3.5, mt: 0.2, fontSize: 10.5 }}>
            You can always switch properties using the blue sidebar icon.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.2, pt: 1, justifyContent: "space-between", borderTop: "1px solid var(--border-color, #f1f5f9)" }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: "10px",
            textTransform: "none",
            fontWeight: 600,
            fontSize: 12.5,
            px: 2,
            color: "text.secondary",
            borderColor: "var(--border-color, #cbd5e1)",
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSwitchSubmit}
          variant="contained"
          size="small"
          disabled={!selectedPropertyId}
          sx={{
            borderRadius: "10px",
            textTransform: "none",
            fontWeight: 700,
            fontSize: 12.5,
            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
            px: 2.5,
            py: 0.8,
            "&:hover": {
              background: "linear-gradient(135deg, #17386d 0%, #1d4ed8 100%)",
            },
          }}
        >
          {targetModule
            ? isSwitchingProperty
              ? `Switch & Open ${targetModule.name}`
              : `Open ${targetModule.name}`
            : "Confirm Active Property"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
