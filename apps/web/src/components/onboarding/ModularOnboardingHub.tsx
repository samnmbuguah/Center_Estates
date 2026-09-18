"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileSpreadsheet,
  GitBranch,
  Hammer,
  HardHat,
  Home,
  Layers,
  MapPin,
  Rocket,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { PropertyOnboardingForm } from "@/components/property-onboarding-form";
import { SalesOnboardingForm } from "./SalesOnboardingForm";
import { ConstructionOnboardingForm } from "./ConstructionOnboardingForm";
import { AssetLifecycleExtensionView } from "./AssetLifecycleExtensionView";

export function ModularOnboardingHub() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const editId = searchParams?.get("edit");
  const initialModule = searchParams?.get("module") || (editId ? "property" : "");

  const [activeModule, setActiveModule] = useState<string>(initialModule);

  useEffect(() => {
    const mod = searchParams?.get("module");
    if (mod) {
      setActiveModule(mod);
    } else if (editId) {
      setActiveModule("property");
    }
  }, [searchParams, editId]);

  function handleSelectModule(mod: string) {
    setActiveModule(mod);
    const params = new URLSearchParams(window.location.search);
    if (mod) {
      params.set("module", mod);
    } else {
      params.delete("module");
    }
    router.push(`${window.location.pathname}?${params.toString()}`);
  }

  // 1. Selector Hero View (when no module is chosen yet)
  if (!activeModule) {
    return (
      <Box sx={{ minHeight: "85vh", bgcolor: "var(--surface-sunken, #f8fafc)", py: { xs: 3, md: 5 } }}>
        <Container maxWidth="lg">
          {/* Header */}
          <Box sx={{ textAlign: "center", mb: 5 }}>
            <Chip
              icon={<Sparkles size={14} color="var(--primary, #2563eb)" />}
              label="Modular Asset Onboarding & Lifecycle"
              sx={{
                mb: 1.5,
                fontWeight: 700,
                fontSize: 12,
                bgcolor: "rgba(37, 99, 235, 0.08)",
                color: "var(--primary, #2563eb)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
              }}
            />
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: "-0.02em" }}>
              Select Onboarding Objective
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, mx: "auto" }}>
              Choose which operational module you are setting up for. Each module gathers specific artifacts, and assets can be extended across modules at any time.
            </Typography>
          </Box>

          {/* 3 Main Choice Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Card 1: Property Management */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 3,
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 24px -10px rgba(0, 0, 0, 0.12)",
                    borderColor: "#2563eb",
                  },
                }}
              >
                <CardActionArea
                  onClick={() => handleSelectModule("property")}
                  sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between" }}
                >
                  <Box sx={{ width: "100%" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(37, 99, 235, 0.1)", color: "#2563eb" }}>
                        <Building2 size={28} />
                      </Box>
                      <Chip size="small" label="Leasing & Rentals" sx={{ fontWeight: 700, fontSize: 11 }} />
                    </Box>

                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                      Property Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, minHeight: 40 }}>
                      Onboard an existing building or sectional title scheme for tenant leasing, rent collections, and utility meters.
                    </Typography>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, my: 2 }}>
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                        <CheckCircle2 size={14} color="var(--color-success, #10b981)" /> Physical building & Landlord mandate
                      </Typography>
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                        <CheckCircle2 size={14} color="var(--color-success, #10b981)" /> Rental units & service charges
                      </Typography>
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                        <CheckCircle2 size={14} color="var(--color-success, #10b981)" /> Utility sub-meters & paper lease import
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
                    endIcon={<ChevronRight size={16} />}
                  >
                    Onboard Property
                  </Button>
                </CardActionArea>
              </Card>
            </Grid>

            {/* Card 2: Construction Management */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 3,
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 24px -10px rgba(0, 0, 0, 0.12)",
                    borderColor: "var(--color-amber-strong, #f59e0b)",
                  },
                }}
              >
                <CardActionArea
                  onClick={() => handleSelectModule("construction")}
                  sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between" }}
                >
                  <Box sx={{ width: "100%" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(245, 158, 11, 0.1)", color: "var(--color-amber-strong, #f59e0b)" }}>
                        <HardHat size={28} />
                      </Box>
                      <Chip size="small" label="Site & Civil Works" sx={{ fontWeight: 700, fontSize: 11 }} />
                    </Box>

                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                      Construction Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, minHeight: 40 }}>
                      Onboard a capital development project, contractor team, GIS site geofence, BOQ items, and milestone programme.
                    </Typography>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, my: 2 }}>
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                        <CheckCircle2 size={14} color="var(--color-success, #10b981)" /> Site coordinates & evidence geofencing
                      </Typography>
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                        <CheckCircle2 size={14} color="var(--color-success, #10b981)" /> Main contractor & consultant directory
                      </Typography>
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                        <CheckCircle2 size={14} color="var(--color-success, #10b981)" /> BOQ baseline & NEMA/approvals checklist
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2, bgcolor: "#d97706", "&:hover": { bgcolor: "#b45309" } }}
                    endIcon={<ChevronRight size={16} />}
                  >
                    Onboard Construction
                  </Button>
                </CardActionArea>
              </Card>
            </Grid>

            {/* Card 3: Sales & Off-Plan */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 3,
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 24px -10px rgba(0, 0, 0, 0.12)",
                    borderColor: "var(--primary, #2563eb)",
                  },
                }}
              >
                <CardActionArea
                  onClick={() => handleSelectModule("sales")}
                  sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between" }}
                >
                  <Box sx={{ width: "100%" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(37, 99, 235, 0.1)", color: "var(--primary, #2563eb)" }}>
                        <Tag size={28} />
                      </Box>
                      <Chip size="small" label="Commercial Sales" sx={{ fontWeight: 700, fontSize: 11 }} />
                    </Box>

                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                      Sales & Off-Plan Scheme
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, minHeight: 40 }}>
                      Launch an off-plan development or unit sales campaign, set price tiers and deposit rules, and manage buyer leads.
                    </Typography>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, my: 2 }}>
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                        <CheckCircle2 size={14} color="var(--color-success, #10b981)" /> Sales scheme branding & completion targets
                      </Typography>
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                        <CheckCircle2 size={14} color="var(--color-success, #10b981)" /> Unit mix, list prices & deposit gates
                      </Typography>
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                        <CheckCircle2 size={14} color="var(--color-success, #10b981)" /> 3D unit models & agent pipeline
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2, bgcolor: "var(--primary, #2563eb)", "&:hover": { bgcolor: "#1d4ed8" } }}
                    endIcon={<ChevronRight size={16} />}
                  >
                    Onboard Sales Scheme
                  </Button>
                </CardActionArea>
              </Card>
            </Grid>
          </Grid>

          {/* Bottom Extension Bar */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: "var(--surface, #ffffff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(99, 102, 241, 0.1)", color: "#6366f1" }}>
                <GitBranch size={24} />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Already have an existing project or property?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Seamlessly extend an ongoing Construction site into Sales, or convert completed units into Property Management.
                </Typography>
              </Box>
            </Box>

            <Button
              variant="outlined"
              onClick={() => handleSelectModule("extend")}
              endIcon={<Rocket size={16} />}
              sx={{ fontWeight: 700 }}
            >
              Extend Existing Asset &rarr;
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  // 2. Active Module Workflow with Top Navigation
  return (
    <Box sx={{ width: "100%", bgcolor: "var(--background, #ffffff)" }}>
      {/* Top Module Sub-Nav */}
      <Paper
        square
        variant="outlined"
        sx={{
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          px: { xs: 2, md: 3 },
          py: 1,
          bgcolor: "var(--surface-sunken, #f8fafc)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => handleSelectModule("")}
            sx={{ fontWeight: 700, fontSize: 13, textTransform: "none" }}
          >
            &larr; All Onboarding Options
          </Button>
          <Typography variant="caption" sx={{ color: "var(--border, #cbd5e1)" }}>|</Typography>
          <Tabs
            value={activeModule}
            onChange={(_, val) => handleSelectModule(val)}
            sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5, px: 1.5, fontSize: 13, fontWeight: 700, textTransform: "none" } }}
          >
            <Tab value="property" label="🏢 Property Mgmt" />
            <Tab value="construction" label="🏗️ Construction" />
            <Tab value="sales" label="🏷️ Sales Scheme" />
            <Tab value="extend" label="⚡ Extend Asset" />
          </Tabs>
        </Box>
      </Paper>

      {/* Main Workflow Body */}
      <Box sx={{ py: 2 }}>
        {activeModule === "property" && <PropertyOnboardingForm onBack={() => handleSelectModule("")} />}
        {activeModule === "construction" && <ConstructionOnboardingForm onBack={() => handleSelectModule("")} />}
        {activeModule === "sales" && <SalesOnboardingForm onBack={() => handleSelectModule("")} />}
        {activeModule === "extend" && <AssetLifecycleExtensionView onBack={() => handleSelectModule("")} />}
      </Box>
    </Box>
  );
}
