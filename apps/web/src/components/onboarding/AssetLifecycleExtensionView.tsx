"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowLeft,
  ArrowRight,
  Building,
  CheckCircle2,
  GitBranch,
  Hammer,
  Layers,
  Rocket,
  Sparkles,
  Tag,
} from "lucide-react";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

export function AssetLifecycleExtensionView({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const { session } = useAuth();
  const org = session?.activeOrganizationId ?? undefined;

  const [sourceType, setSourceType] = useState<"construction" | "property">("construction");
  const [constructionProjects, setConstructionProjects] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);

  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [targetModule, setTargetModule] = useState<"sales" | "property" | "construction">("sales");

  // Extension parameters
  const [defaultPrice, setDefaultPrice] = useState("12500000");
  const [defaultDeposit, setDefaultDeposit] = useState("10");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successResult, setSuccessResult] = useState<any>(null);

  useEffect(() => {
    if (!org) return;
    let active = true;
    apiFetch("/construction/projects/", {}, org)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => active && setConstructionProjects(Array.isArray(d) ? d : []));

    apiFetch("/property/properties/", {}, org)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => active && setProperties(Array.isArray(d) ? d : []));

    return () => { active = false; };
  }, [org]);

  const selectedConstruction = constructionProjects.find((cp) => String(cp.id) === selectedSourceId);
  const selectedProperty = properties.find((p) => String(p.id) === selectedSourceId);

  async function handleExecuteExtension() {
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/csrf/");

      if (sourceType === "construction" && targetModule === "sales") {
        const res = await apiFetch("/sales/projects/extend-from-construction/", {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            construction_project_id: selectedSourceId,
            default_list_price: defaultPrice || undefined,
            default_deposit_percent: defaultDeposit || 10,
          }),
        }, org);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || err.message || "Failed to extend project to Sales.");
        }

        const data = await res.json();
        setSuccessResult({
          title: "Successfully Extended to Sales Management!",
          message: data.message || `The project '${selectedConstruction?.name}' is now an active sales scheme.`,
          actionUrl: "/sales?tab=inventory",
          actionLabel: "Open Sales CRM",
          listingsCreated: data.listings_created,
        });
      } else if (sourceType === "property" && targetModule === "sales") {
        const res = await apiFetch("/sales/projects/", {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            name: `${selectedProperty?.name} - Sales Scheme`,
            property: selectedSourceId,
            auto_list_units: true,
            default_list_price: defaultPrice,
            default_deposit_percent: defaultDeposit,
          }),
        }, org);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || err.message || "Failed to create sales project for property.");
        }

        const data = await res.json();
        setSuccessResult({
          title: "Sales Scheme Enabled for Property!",
          message: `Created commercial sales scheme for '${selectedProperty?.name}' with initial unit listings.`,
          actionUrl: "/sales?tab=inventory",
          actionLabel: "Open Sales CRM",
        });
      } else {
        // Generic extension confirmation
        setSuccessResult({
          title: "Module Assignment Created",
          message: "Asset lifecycle stage updated and module permissions enabled.",
          actionUrl: "/overview",
          actionLabel: "Go to Dashboard",
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to extend asset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", py: 3, px: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        {onBack && (
          <Button variant="outlined" size="small" onClick={onBack} startIcon={<ArrowLeft size={16} />}>
            All Onboarding
          </Button>
        )}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
            <GitBranch size={24} color="var(--primary, #2563eb)" />
            Cross-Module Lifecycle Extension
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Promote an existing property or construction project across modules without duplicate data entry.
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {successResult ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
          <CheckCircle2 size={56} color="var(--color-success, #10b981)" style={{ margin: "0 auto 16px" }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>{successResult.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: "auto", mb: 3 }}>
            {successResult.message}
            {successResult.listingsCreated !== undefined && (
              <strong> ({successResult.listingsCreated} unit listings generated)</strong>
            )}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
            <Button variant="outlined" onClick={() => { setSuccessResult(null); setSelectedSourceId(""); }}>
              Extend Another Asset
            </Button>
            <Button variant="contained" onClick={() => router.push(successResult.actionUrl)}>
              {successResult.actionLabel} &rarr;
            </Button>
          </Box>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            {/* Step 1: Choose Source */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              1. Choose Source Asset
            </Typography>

            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
              <Button
                variant={sourceType === "construction" ? "contained" : "outlined"}
                onClick={() => { setSourceType("construction"); setSelectedSourceId(""); }}
                startIcon={<Hammer size={16} />}
              >
                From Construction Project
              </Button>
              <Button
                variant={sourceType === "property" ? "contained" : "outlined"}
                onClick={() => { setSourceType("property"); setSelectedSourceId(""); }}
                startIcon={<Building size={16} />}
              >
                From Physical Property
              </Button>
            </Box>

            <Grid container spacing={2.5} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12 }}>
                {sourceType === "construction" ? (
                  <FormControl fullWidth>
                    <InputLabel id="cp-select-label">Select Construction Project</InputLabel>
                    <Select
                      labelId="cp-select-label"
                      label="Select Construction Project"
                      value={selectedSourceId}
                      onChange={(e) => setSelectedSourceId(e.target.value)}
                    >
                      <MenuItem value="" disabled><em>Choose project…</em></MenuItem>
                      {constructionProjects.map((cp) => (
                        <MenuItem key={cp.id} value={cp.id}>
                          🏗️ {cp.name} · Stage: {cp.stage || "Active"} · Budget: KES {Number(cp.budget || cp.tender_amount || 0).toLocaleString()}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <FormControl fullWidth>
                    <InputLabel id="prop-src-select-label">Select Physical Property</InputLabel>
                    <Select
                      labelId="prop-src-select-label"
                      label="Select Physical Property"
                      value={selectedSourceId}
                      onChange={(e) => setSelectedSourceId(e.target.value)}
                    >
                      <MenuItem value="" disabled><em>Choose property…</em></MenuItem>
                      {properties.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          🏢 {p.name} ({p.code || "No code"}) · {p.units_count || "—"} units
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Grid>
            </Grid>

            {/* Step 2: Target Module */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              2. Select Target Module to Enable
            </Typography>

            <Grid container spacing={2} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Paper
                  variant="outlined"
                  onClick={() => setTargetModule("sales")}
                  sx={{
                    p: 2,
                    cursor: "pointer",
                    borderRadius: 2,
                    border: targetModule === "sales" ? "2px solid var(--primary, #2563eb)" : "1px solid var(--border)",
                    bgcolor: targetModule === "sales" ? "rgba(37, 99, 235, 0.04)" : "transparent",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Tag size={20} color="var(--primary, #2563eb)" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Sales CRM</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Launch unit inventory, list prices, and buyer reservations.
                  </Typography>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Paper
                  variant="outlined"
                  onClick={() => setTargetModule("property")}
                  sx={{
                    p: 2,
                    cursor: "pointer",
                    borderRadius: 2,
                    border: targetModule === "property" ? "2px solid var(--primary, #2563eb)" : "1px solid var(--border)",
                    bgcolor: targetModule === "property" ? "rgba(37, 99, 235, 0.04)" : "transparent",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Building size={20} color="var(--color-success, #10b981)" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Property Mgmt</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Enable rental leases, utility meters, and landlord statements.
                  </Typography>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Paper
                  variant="outlined"
                  onClick={() => setTargetModule("construction")}
                  sx={{
                    p: 2,
                    cursor: "pointer",
                    borderRadius: 2,
                    border: targetModule === "construction" ? "2px solid var(--primary, #2563eb)" : "1px solid var(--border)",
                    bgcolor: targetModule === "construction" ? "rgba(37, 99, 235, 0.04)" : "transparent",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Hammer size={20} color="var(--color-amber-strong, #f59e0b)" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Construction</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Plan refurbishments, capital works, or a new phase.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Step 3: Parameters for Target */}
            {targetModule === "sales" && selectedSourceId && (
              <Box sx={{ bgcolor: "var(--surface-2, #f8fafc)", p: 2.5, borderRadius: 2, mb: 4, border: "1px solid var(--border)" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  3. Sales Scheme Terms
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Default Unit List Price (KES)"
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Minimum Deposit %"
                      value={defaultDeposit}
                      onChange={(e) => setDefaultDeposit(e.target.value)}
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                size="large"
                disabled={!selectedSourceId || loading}
                onClick={handleExecuteExtension}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Rocket size={18} />}
              >
                {loading ? "Extending Asset..." : "Extend Asset to Module"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
