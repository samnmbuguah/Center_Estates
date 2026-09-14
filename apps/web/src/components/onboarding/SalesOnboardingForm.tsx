"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowLeft,
  Building,
  CheckCircle2,
  DollarSign,
  FileText,
  Layers,
  Rocket,
  Sparkles,
  Tag,
} from "lucide-react";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

const STEPS = ["Scheme Setup", "Unit Mix & Pricing", "Commercial Terms", "Review & Launch"];

export function SalesOnboardingForm({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const { session } = useAuth();
  const org = session?.activeOrganizationId ?? undefined;

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<any>(null);

  // Available options
  const [properties, setProperties] = useState<any[]>([]);
  const [constructionProjects, setConstructionProjects] = useState<any[]>([]);

  // Step 1: Scheme Setup
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [constructionId, setConstructionId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");

  // Step 2: Unit Mix & Pricing
  const [autoList, setAutoList] = useState(true);
  const [defaultPrice, setDefaultPrice] = useState("12500000");
  const [defaultDeposit, setDefaultDeposit] = useState("10");
  const [targetUnitCount, setTargetUnitCount] = useState("24");

  // Step 3: Commercial Terms & Marketing
  const [reservationFee, setReservationFee] = useState("100000");
  const [reservationDays, setReservationDays] = useState("14");
  const [financingOptions, setFinancingOptions] = useState<string[]>(["cash", "installment", "mortgage"]);
  const [description, setDescription] = useState("");
  const [projectedYield, setProjectedYield] = useState("9.5");

  useEffect(() => {
    if (!org) return;
    let active = true;
    apiFetch("/property/properties/", {}, org)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => active && setProperties(Array.isArray(d) ? d : []));

    apiFetch("/construction/projects/", {}, org)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => active && setConstructionProjects(Array.isArray(d) ? d : []));

    return () => { active = false; };
  }, [org]);

  function handlePropertySelect(pId: string) {
    setPropertyId(pId);
    const prop = properties.find((p) => String(p.id) === pId);
    if (prop && !name) {
      setName(`${prop.name} - Sales Scheme`);
    }
  }

  function handleConstructionSelect(cpId: string) {
    setConstructionId(cpId);
    const cp = constructionProjects.find((p) => String(p.id) === cpId);
    if (cp && !name) {
      setName(cp.name);
    }
  }

  async function handleLaunch() {
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/csrf/");
      const payload: Record<string, any> = {
        name,
        code: code.trim() || undefined,
        property: propertyId || null,
        construction_project_id: constructionId || undefined,
        starts_on: startsOn || undefined,
        ends_on: endsOn || undefined,
        auto_list_units: autoList,
        default_list_price: autoList ? defaultPrice : undefined,
        default_deposit_percent: autoList ? defaultDeposit : undefined,
        metadata: {
          description,
          reservation_fee: reservationFee,
          reservation_period_days: reservationDays,
          financing_options: financingOptions,
          projected_yield_percent: projectedYield,
          target_unit_count: targetUnitCount,
        },
      };

      const res = await apiFetch("/sales/projects/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      }, org);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.name || "Failed to create sales project.");
      }

      const data = await res.json();
      setSuccessData(data);
      setActiveStep(STEPS.length);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 1020, mx: "auto", py: 3, px: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        {onBack && (
          <Button variant="outlined" size="small" onClick={onBack} startIcon={<ArrowLeft size={16} />}>
            All Onboarding
          </Button>
        )}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
            <Tag size={24} color="var(--primary, #2563eb)" />
            Sales & Off-Plan Scheme Onboarding
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Set up an off-plan development or unit sales campaign, define pricing tiers, and generate sales inventory.
          </Typography>
        </Box>
      </Box>

      {/* Stepper */}
      {activeStep < STEPS.length && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>
      )}

      {error && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 2 }}>
          <Typography color="error" variant="body2" sx={{ fontWeight: 600 }}>{error}</Typography>
        </Paper>
      )}

      {/* STEP 0: Scheme Setup */}
      {activeStep === 0 && (
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
              <Building size={18} /> 1. Scheme Identity & Linkages
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Name your sales development and optionally connect it to an existing physical property or ongoing construction site.
            </Typography>

            <Grid container spacing={2.5}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Sales Development / Project Name"
                  placeholder="e.g. Lynx Ngong Rd Apartments - Phase 1 Off-Plan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Project Code (Optional)"
                  placeholder="e.g. SP-0001 (auto-generated if blank)"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Target Completion Date"
                  InputLabelProps={{ shrink: true }}
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="prop-select-label">Link Physical Property</InputLabel>
                  <Select
                    labelId="prop-select-label"
                    label="Link Physical Property"
                    value={propertyId}
                    onChange={(e) => handlePropertySelect(e.target.value)}
                  >
                    <MenuItem value=""><em>None / Standalone Off-Plan Scheme</em></MenuItem>
                    {properties.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        🏢 {p.name} ({p.code || "No code"})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="const-select-label">Link Construction Project</InputLabel>
                  <Select
                    labelId="const-select-label"
                    label="Link Construction Project"
                    value={constructionId}
                    onChange={(e) => handleConstructionSelect(e.target.value)}
                  >
                    <MenuItem value=""><em>None / Direct Sales Only</em></MenuItem>
                    {constructionProjects.map((cp) => (
                      <MenuItem key={cp.id} value={cp.id}>
                        🏗️ {cp.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
              <Button
                variant="contained"
                disabled={!name.trim()}
                onClick={() => setActiveStep(1)}
              >
                Continue to Unit Mix &rarr;
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* STEP 1: Unit Mix & Pricing */}
      {activeStep === 1 && (
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
              <DollarSign size={18} /> 2. Commercial Pricing & Inventory Setup
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Specify the default sales pricing tiers and deposit requirements for units in this development.
            </Typography>

            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Default List Price (KES)"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  placeholder="12500000"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Minimum Deposit Required (%)"
                  value={defaultDeposit}
                  onChange={(e) => setDefaultDeposit(e.target.value)}
                  placeholder="10"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Planned / Target Units Count"
                  value={targetUnitCount}
                  onChange={(e) => setTargetUnitCount(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Projected Gross Rental Yield (%)"
                  value={projectedYield}
                  onChange={(e) => setProjectedYield(e.target.value)}
                  placeholder="9.5"
                />
              </Grid>

              {propertyId && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: "rgba(37, 99, 235, 0.05)", border: "1px solid rgba(37, 99, 235, 0.2)", borderRadius: 2 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={autoList}
                        onChange={(e) => setAutoList(e.target.checked)}
                      />
                      <span>⚡ Automatically create sale listings for all existing units in the selected property</span>
                    </label>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, ml: 3 }}>
                      All unlisted units in this physical building will immediately be published into the Sales inventory with KES {Number(defaultPrice || 0).toLocaleString()} list price.
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>

            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
              <Button variant="outlined" onClick={() => setActiveStep(0)}>Back</Button>
              <Button variant="contained" onClick={() => setActiveStep(2)}>
                Continue to Terms &rarr;
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Commercial Terms & Marketing */}
      {activeStep === 2 && (
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
              <FileText size={18} /> 3. Reservation & Commercial Terms
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure buyer reservation rules and marketing pitch for sales agents and buyer portal.
            </Typography>

            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Standard Reservation Fee (KES)"
                  value={reservationFee}
                  onChange={(e) => setReservationFee(e.target.value)}
                  placeholder="100000"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Reservation Holding Period (Days)"
                  value={reservationDays}
                  onChange={(e) => setReservationDays(e.target.value)}
                  placeholder="14"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Marketing Pitch & Amenities Overview"
                  placeholder="High-speed lifts, rooftop heated pool, 24/7 borehole backup, prime rental yield location..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Grid>
            </Grid>

            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
              <Button variant="outlined" onClick={() => setActiveStep(1)}>Back</Button>
              <Button variant="contained" onClick={() => setActiveStep(3)}>
                Review Scheme &rarr;
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Review & Launch */}
      {activeStep === 3 && (
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <Rocket size={18} color="var(--primary, #2563eb)" /> 4. Review & Launch Scheme
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Scheme Name</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{name}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Default Unit List Price</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "var(--primary, #2563eb)" }}>
                    KES {Number(defaultPrice || 0).toLocaleString()} ({defaultDeposit}% deposit)
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Linked Physical Property</Typography>
                  <Typography variant="subtitle2">
                    {propertyId ? properties.find(p => String(p.id) === propertyId)?.name || "Linked" : "None (Standalone)"}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Linked Construction Site</Typography>
                  <Typography variant="subtitle2">
                    {constructionId ? constructionProjects.find(cp => String(cp.id) === constructionId)?.name || "Linked" : "None"}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
              <Button variant="outlined" onClick={() => setActiveStep(2)}>Back</Button>
              <Button
                variant="contained"
                color="primary"
                size="large"
                disabled={loading}
                onClick={handleLaunch}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Sparkles size={18} />}
              >
                {loading ? "Activating Scheme..." : "Launch Sales Scheme"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* SUCCESS SCREEN */}
      {activeStep === STEPS.length && (
        <Card variant="outlined" sx={{ borderRadius: 2, textAlign: "center", py: 5, px: 3 }}>
          <CheckCircle2 size={56} color="var(--color-success, #10b981)" style={{ margin: "0 auto 16px" }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            🎉 Sales Scheme Successfully Launched!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: "auto", mb: 4 }}>
            <strong>{name}</strong> is now live in the Sales CRM. You can record buyer inquiries, issue offer letters, and manage reservations.
          </Typography>

          <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
            <Button
              variant="outlined"
              onClick={() => {
                setName("");
                setActiveStep(0);
                setSuccessData(null);
              }}
            >
              Onboard Another Scheme
            </Button>
            <Button
              variant="contained"
              onClick={() => router.push("/sales?tab=inventory")}
            >
              Open Sales Inventory &rarr;
            </Button>
          </Box>
        </Card>
      )}
    </Box>
  );
}
