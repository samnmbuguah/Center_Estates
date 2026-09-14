"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowLeft, Save, Sparkles, Building2, Tag, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/monitoring/hooks/useToast";

interface SalesOnboardingFormProps {
  onBack?: () => void;
}

const sections = [
  ["general", "Scheme Details"],
  ["commercial", "Pricing & Pricing Tiers"],
  ["reservation", "Reservation Terms"],
  ["marketing", "Marketing & Amenities"],
  ["links", "Linked Assets & Inventory"],
  ["notes", "Internal & Agent Notes"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Paper
      className="onboarding-section"
      role="tabpanel"
      id={id}
      aria-labelledby={`sales-tab-${id}`}
      variant="outlined"
      sx={{ p: { xs: 2, md: 2.5 } }}
    >
      <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
        {title}
      </Typography>
      <Box sx={{ mt: 1.25 }}>{children}</Box>
    </Paper>
  );
}

function Grid({ children, columns = 3 }: { children: React.ReactNode; columns?: number }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: `repeat(${columns}, minmax(0, 1fr))` },
        gap: 2,
      }}
    >
      {children}
    </Box>
  );
}

export function SalesOnboardingForm({ onBack }: SalesOnboardingFormProps) {
  const router = useRouter();
  const { session } = useAuth();
  const { toast } = useToast();
  const organizationId = session?.activeOrganizationId ?? null;

  const [section, setSection] = useState("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("off_plan_apartments");
  const [stage, setStage] = useState("active");
  const [currency, setCurrency] = useState("KES");
  const [endsOn, setEndsOn] = useState("");
  const [description, setDescription] = useState("");

  // Commercial & Pricing
  const [defaultPrice, setDefaultPrice] = useState("12500000");
  const [defaultDeposit, setDefaultDeposit] = useState("10");
  const [targetUnitCount, setTargetUnitCount] = useState("24");
  const [projectedYield, setProjectedYield] = useState("9.5");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // Reservation Terms
  const [reservationFee, setReservationFee] = useState("100000");
  const [reservationDays, setReservationDays] = useState("14");
  const [paymentPlanType, setPaymentPlanType] = useState("milestones");
  const [refundPolicy, setRefundPolicy] = useState("100_refundable_14d");
  const [escrowBank, setEscrowBank] = useState("");

  // Marketing & Amenities
  const [tagline, setTagline] = useState("");
  const [amenities, setAmenities] = useState(
    "High-speed lifts, rooftop heated pool, 24/7 borehole backup, generator, CCTV & biometric access"
  );
  const [brochureUrl, setBrochureUrl] = useState("");
  const [virtualTourUrl, setVirtualTourUrl] = useState("");

  // Linked Assets
  const [propertyId, setPropertyId] = useState("");
  const [constructionId, setConstructionId] = useState("");
  const [autoList, setAutoList] = useState(true);

  // Notes & Agent incentives
  const [brokerCommission, setBrokerCommission] = useState("3.0");
  const [notes, setNotes] = useState("");

  // Available linked options
  const [properties, setProperties] = useState<any[]>([]);
  const [constructionProjects, setConstructionProjects] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    apiFetch("/property/properties/", { headers: { "X-Property-Scope": "portfolio" } }, organizationId)
      .then(async (res) => {
        if (!active || !res.ok) return;
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => {});

    apiFetch("/construction/projects/", {}, organizationId)
      .then(async (res) => {
        if (!active || !res.ok) return;
        const data = await res.json();
        setConstructionProjects(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [organizationId]);

  const jump = (id: string) => {
    setSection(id);
    document.querySelector(".sales-onboarding-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Readiness evaluation matching PropertyOnboardingForm
  const readiness = useMemo(() => {
    const checks = [
      { section: "general", label: "Scheme name", complete: Boolean(name.trim()) },
      { section: "general", label: "Target handover date", complete: Boolean(endsOn) },
      {
        section: "commercial",
        label: "Default unit list price",
        complete: Boolean(defaultPrice && Number(defaultPrice) > 0),
      },
      {
        section: "commercial",
        label: "Deposit requirement",
        complete: Boolean(defaultDeposit && Number(defaultDeposit) > 0),
      },
      {
        section: "reservation",
        label: "Reservation fee & days",
        complete: Boolean(reservationFee && Number(reservationFee) > 0 && reservationDays),
      },
      {
        section: "marketing",
        label: "Marketing headline or pitch",
        complete: Boolean(tagline.trim() || description.trim()),
      },
      {
        section: "links",
        label: "Property link or standalone",
        complete: Boolean(propertyId || constructionId || name.trim().length > 3),
      },
    ];
    const completed = checks.filter((c) => c.complete).length;
    return {
      checks,
      completed,
      score: Math.round((completed / checks.length) * 100),
      missing: checks.filter((c) => !c.complete),
    };
  }, [name, endsOn, defaultPrice, defaultDeposit, reservationFee, reservationDays, tagline, description, propertyId, constructionId]);

  const handlePropertySelect = (propId: string) => {
    setPropertyId(propId);
    if (!propId) return;
    const prop = properties.find((p) => String(p.id) === String(propId));
    if (prop) {
      if (!name) setName(`${prop.name} - Sales Scheme`);
      if (prop.metadata?.description && !description) setDescription(prop.metadata.description);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please enter a scheme / project name before saving.");
      jump("general");
      return;
    }
    if (!defaultPrice || Number(defaultPrice) <= 0) {
      setError("Please enter a valid default list price for units in this scheme.");
      jump("commercial");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        code: code.trim() || undefined,
        status: stage,
        property: propertyId ? Number(propertyId) : undefined,
        description: description.trim() || tagline.trim() || undefined,
        ends_on: endsOn || undefined,
        metadata: {
          category,
          currency,
          commercial: {
            default_list_price: Number(defaultPrice),
            default_deposit_percent: Number(defaultDeposit || 10),
            target_units: Number(targetUnitCount || 0),
            projected_yield: Number(projectedYield || 0),
            price_range_min: minPrice ? Number(minPrice) : undefined,
            price_range_max: maxPrice ? Number(maxPrice) : undefined,
          },
          reservation: {
            fee: Number(reservationFee || 0),
            holding_days: Number(reservationDays || 14),
            payment_plan: paymentPlanType,
            refund_policy: refundPolicy,
            escrow_bank: escrowBank.trim(),
          },
          marketing: {
            tagline: tagline.trim(),
            amenities: amenities.trim(),
            brochure_url: brochureUrl.trim(),
            virtual_tour_url: virtualTourUrl.trim(),
          },
          broker: {
            commission_percent: Number(brokerCommission || 0),
          },
          notes: notes.trim(),
          construction_project_id: constructionId || undefined,
          onboarding_readiness: {
            score: readiness.score,
            completed: readiness.completed,
            total: readiness.checks.length,
          },
        },
      };

      const res = await apiFetch(
        "/sales/projects/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        organizationId
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || err?.name?.[0] || "Failed to save sales scheme.");
      }

      const createdProject = await res.json();

      // If auto-listing is enabled and a property was chosen, batch create listings
      if (propertyId && autoList) {
        try {
          await apiFetch(
            "/sales/listings/batch_create/",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                project_id: createdProject.id,
                property_id: Number(propertyId),
                list_price: Number(defaultPrice),
                deposit_required: (Number(defaultPrice) * Number(defaultDeposit || 10)) / 100,
              }),
            },
            organizationId
          );
        } catch {
          // Non-blocking listing batch creation
        }
      }

      toast.success(`${createdProject.name || name} sales scheme created successfully!`);
      if (onBack) {
        onBack();
      } else {
        router.push("/sales");
      }
    } catch (e: any) {
      setError(e?.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (onBack) onBack();
    else router.push("/sales");
  };

  return (
    <Box className="sales-onboarding-card" sx={{ width: "100%", maxWidth: 1320, mx: "auto", px: { xs: 1.5, md: 3 }, py: 2.5 }}>
      {/* Top Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton aria-label="Back" onClick={handleBack}>
            <ArrowLeft />
          </IconButton>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", md: "1.5rem" } }}>
              Sales Scheme Onboarding
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Set up off-plan schemes, unit pricing tiers, reservation terms, and marketing assets.
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            justifyContent: { xs: "stretch", sm: "flex-end" },
            width: { xs: "100%", sm: "auto" },
          }}
        >
          <Button
            variant="contained"
            startIcon={<Save size={17} />}
            disabled={saving}
            onClick={handleSave}
            sx={{ minWidth: { xs: "100%", sm: 120 } }}
          >
            {saving ? "Saving…" : "Save & Close"}
          </Button>
        </Box>
      </Box>

      {/* Onboarding Readiness Card */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: "background.paper" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Onboarding readiness
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {readiness.completed} of {readiness.checks.length} setup areas complete. You can save a draft and continue later.
            </Typography>
          </Box>
          <Chip
            label={`${readiness.score}%`}
            color={readiness.score === 100 ? "success" : readiness.score >= 60 ? "warning" : "default"}
            sx={{ fontWeight: 800, fontSize: 14 }}
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={readiness.score}
          color={readiness.score === 100 ? "success" : "primary"}
          sx={{ height: 8, borderRadius: 99, mb: readiness.missing.length ? 1.5 : 0 }}
        />
        {readiness.missing.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {readiness.missing.map((item) => (
              <Chip
                key={`${item.section}:${item.label}`}
                size="small"
                variant="outlined"
                label={`Add ${item.label}`}
                onClick={() => jump(item.section)}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Sticky Horizontal Tabs Navigation */}
      <Paper variant="outlined" sx={{ position: "sticky", top: 76, zIndex: 5, mb: 2, overflowX: "auto" }}>
        <Tabs
          value={section}
          onChange={(_, value) => jump(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Sales onboarding sections"
          sx={{
            minHeight: 40,
            "& .MuiTab-root": { minHeight: 40, fontSize: { xs: 12, md: 14 }, fontWeight: 600, textTransform: "none" },
          }}
        >
          {sections.map(([id, label]) => (
            <Tab id={`sales-tab-${id}`} aria-controls={id} key={id} value={id} label={label} />
          ))}
        </Tabs>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setError("")}
          sx={{ mb: 2, position: "sticky", top: 128, zIndex: 4, boxShadow: 3, borderRadius: 2 }}
        >
          <strong>Action needed:</strong> {error} Your entered information has been retained.
        </Alert>
      )}

      {/* Form Sections */}
      <Box sx={{ display: "grid", gap: 2, [`& > .onboarding-section:not(#${section})`]: { display: "none" } }}>
        {/* Section 1: General Scheme Details */}
        <Section id="general" title="Scheme Details & Overview">
          <Grid>
            <TextField
              label="Scheme code"
              placeholder="e.g. SP-0001 (auto-generated if empty)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <TextField
              required
              label="Sales scheme / project name"
              placeholder="e.g. Skyview Heights Phase 1 Off-Plan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField select required label="Scheme status" value={stage} onChange={(e) => setStage(e.target.value)}>
              <MenuItem value="planning">Planning / Pre-Launch</MenuItem>
              <MenuItem value="active">Active Selling</MenuItem>
              <MenuItem value="sold_out">Sold Out</MenuItem>
              <MenuItem value="completed">Completed / Handover</MenuItem>
            </TextField>
            <TextField
              select
              required
              label="Scheme category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <MenuItem value="off_plan_apartments">Off-Plan Residential Apartments</MenuItem>
              <MenuItem value="gated_villas">Gated Community Villas</MenuItem>
              <MenuItem value="commercial_strata">Commercial Strata / Retail</MenuItem>
              <MenuItem value="serviced_plots">Serviced Plots / Master Planned</MenuItem>
              <MenuItem value="mixed_use">Mixed-Use Scheme</MenuItem>
            </TextField>
            <TextField
              type="date"
              label="Target handover date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
            <TextField select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <MenuItem value="KES">KES — Kenyan Shilling</MenuItem>
              <MenuItem value="USD">USD — US Dollar</MenuItem>
              <MenuItem value="EUR">EUR — Euro</MenuItem>
              <MenuItem value="GBP">GBP — British Pound</MenuItem>
            </TextField>
          </Grid>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Scheme overview & description"
            placeholder="Executive luxury units located in a prime neighborhood with panoramic views and strong capital growth potential..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mt: 2 }}
          />
        </Section>

        {/* Section 2: Commercial & Pricing Tiers */}
        <Section id="commercial" title="Commercial & Pricing Tiers">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set baseline list prices and deposit minimums. These default values apply to auto-generated unit listings and financial yield calculations.
          </Typography>
          <Grid>
            <TextField
              required
              type="number"
              label="Default unit list price"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
              placeholder="12500000"
            />
            <TextField
              required
              type="number"
              label="Minimum deposit required (%)"
              value={defaultDeposit}
              onChange={(e) => setDefaultDeposit(e.target.value)}
              placeholder="10"
            />
            <TextField
              type="number"
              label="Planned total unit count"
              value={targetUnitCount}
              onChange={(e) => setTargetUnitCount(e.target.value)}
              placeholder="24"
            />
            <TextField
              type="number"
              label="Projected gross rental yield (%)"
              value={projectedYield}
              onChange={(e) => setProjectedYield(e.target.value)}
              placeholder="9.5"
            />
            <TextField
              type="number"
              label="Lowest unit price in tier"
              placeholder="e.g. 9500000 (1 Bed)"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <TextField
              type="number"
              label="Highest unit price in tier"
              placeholder="e.g. 24000000 (Penthouse)"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </Grid>
        </Section>

        {/* Section 3: Reservation Terms */}
        <Section id="reservation" title="Buyer Reservation & Deposit Rules">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Define the legal and financial terms under which prospective buyers can lock in a unit off-plan.
          </Typography>
          <Grid>
            <TextField
              type="number"
              label="Standard reservation fee (KES)"
              value={reservationFee}
              onChange={(e) => setReservationFee(e.target.value)}
              placeholder="100000"
            />
            <TextField
              type="number"
              label="Reservation holding period (Days)"
              value={reservationDays}
              onChange={(e) => setReservationDays(e.target.value)}
              placeholder="14"
            />
            <TextField
              select
              label="Permitted payment structure"
              value={paymentPlanType}
              onChange={(e) => setPaymentPlanType(e.target.value)}
            >
              <MenuItem value="milestones">Milestone-linked installments (e.g. 10% deposit, 20% slab, etc.)</MenuItem>
              <MenuItem value="mortgage_bank">Approved Bank Mortgage / Facility</MenuItem>
              <MenuItem value="cash_purchase">Cash Purchase / Accelerated discount</MenuItem>
              <MenuItem value="rent_to_own">Rent-To-Own Scheme</MenuItem>
              <MenuItem value="flexible">Custom Developer Flexible Plan</MenuItem>
            </TextField>
            <TextField
              select
              label="Reservation refund policy"
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value)}
            >
              <MenuItem value="100_refundable_14d">100% Refundable within 14-day cooling-off window</MenuItem>
              <MenuItem value="non_refundable">Strictly Non-Refundable</MenuItem>
              <MenuItem value="refundable_minus_admin">Refundable minus 10% administrative levy</MenuItem>
            </TextField>
            <TextField
              label="Escrow / project bank account"
              placeholder="e.g. NCBA Bank - Account 12345678"
              value={escrowBank}
              onChange={(e) => setEscrowBank(e.target.value)}
            />
          </Grid>
        </Section>

        {/* Section 4: Marketing & Amenities */}
        <Section id="marketing" title="Marketing, Pitch & Amenities">
          <Grid columns={2}>
            <TextField
              label="Marketing headline / hook"
              placeholder="e.g. Nairobi's Most Prestigious Skyline Residences - 9.5% Projected Yield"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
            <TextField
              label="Digital brochure download URL"
              placeholder="https://centerestates.com/brochures/skyview.pdf"
              value={brochureUrl}
              onChange={(e) => setBrochureUrl(e.target.value)}
            />
          </Grid>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Amenities & Lifestyle Highlights"
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            label="Virtual Tour / 3D Render Walkthrough URL"
            placeholder="https://matterport.com/show/?m=example"
            value={virtualTourUrl}
            onChange={(e) => setVirtualTourUrl(e.target.value)}
            sx={{ mt: 2 }}
          />
        </Section>

        {/* Section 5: Linked Assets & Units */}
        <Section id="links" title="Linked Assets & Unit Inventory">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Link an existing physical building to automatically import all units into your sales inventory, or link an ongoing construction project to track live progress.
          </Typography>
          <Grid columns={2}>
            <TextField
              select
              label="Link physical property"
              value={propertyId}
              onChange={(e) => handlePropertySelect(e.target.value)}
            >
              <MenuItem value="">
                <em>None (Standalone Off-Plan Scheme)</em>
              </MenuItem>
              {properties.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  🏢 {p.name} {p.code ? `(${p.code})` : ""} · {p.units_count || "—"} units
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Link construction site"
              value={constructionId}
              onChange={(e) => setConstructionId(e.target.value)}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {constructionProjects.map((cp) => (
                <MenuItem key={cp.id} value={String(cp.id)}>
                  🏗️ {cp.name} · Stage: {cp.stage || "Active"} · Budget: KES {Number(cp.budget || 0).toLocaleString()}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {propertyId && (
            <Paper
              variant="outlined"
              sx={{
                mt: 2.5,
                p: 2,
                bgcolor: "rgba(37, 99, 235, 0.04)",
                borderColor: "rgba(37, 99, 235, 0.2)",
                borderRadius: 2,
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={autoList}
                    onChange={(e) => setAutoList(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    ⚡ Automatically create sale listings for all existing units in the selected property
                  </Typography>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, ml: 4 }}>
                All unlisted units in this building will immediately be published into the Sales CRM inventory with KES{" "}
                {Number(defaultPrice || 0).toLocaleString()} list price and {defaultDeposit}% deposit.
              </Typography>
            </Paper>
          )}
        </Section>

        {/* Section 6: Internal & Agent Notes */}
        <Section id="notes" title="Internal Notes & Broker Commission">
          <Grid columns={2}>
            <TextField
              type="number"
              label="External broker commission (%)"
              value={brokerCommission}
              onChange={(e) => setBrokerCommission(e.target.value)}
              placeholder="3.0"
            />
          </Grid>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Internal sales notes & guidelines"
            placeholder="Notes regarding legal conveyancing counsel, special VIP discounts, and payment escrow handling..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </Section>
      </Box>
    </Box>
  );
}
