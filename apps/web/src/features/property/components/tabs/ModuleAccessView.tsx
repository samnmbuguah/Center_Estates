"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Chip, CircularProgress, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { Panel } from "@/components/module-ui";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/monitoring/hooks/useToast";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type PropertyRow = { id: string; code?: string; name: string; modules?: string[] };
type Assignment = { id: string; property: string; module: string; is_enabled: boolean };

const MODULES: { slug: string; label: string; icon: string }[] = [
  { slug: "property", label: "Property Management", icon: "🏢" },
  { slug: "facility", label: "Facility Management", icon: "🔧" },
  { slug: "sales", label: "Sales Management", icon: "💰" },
  { slug: "monitoring", label: "Construction", icon: "🏗️" },
  { slug: "tender", label: "Tender", icon: "📑" },
  { slug: "valuation", label: "Valuation", icon: "📈" },
  { slug: "companion", label: "Companion", icon: "🤖" },
];

export function ModuleAccessView() {
  const { session } = useAuth();
  const { toast } = useToast();
  const organizationId = session?.activeOrganizationId ?? null;
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const [propertiesRes, assignmentsRes] = await Promise.all([
        apiFetch("/property/properties/", { headers: { "X-Property-Scope": "portfolio" } }, organizationId),
        apiFetch("/property/property-modules/", { headers: { "X-Property-Scope": "portfolio" } }, organizationId),
      ]);
      if (!propertiesRes.ok || !assignmentsRes.ok) {
        setError("Property module access could not be loaded.");
        return;
      }
      const propsJson = await propertiesRes.json();
      const assignmentsJson = await assignmentsRes.json();
      setProperties(Array.isArray(propsJson) ? propsJson : propsJson.results ?? []);
      setAssignments(Array.isArray(assignmentsJson) ? assignmentsJson : assignmentsJson.results ?? []);
    } catch {
      setError("Unable to reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const assignmentFor = (propertyId: string, module: string) =>
    assignments.find((a) => a.property === propertyId && a.module === module);

  async function toggle(property: PropertyRow, module: string) {
    if (!organizationId) return;
    const existing = assignmentFor(property.id, module);
    const nextEnabled = existing ? !existing.is_enabled : false;
    const key = `${property.id}:${module}`;
    setBusy(key);
    try {
      await apiFetch("/auth/csrf/");
      let res: Response;
      if (existing) {
        res = await apiFetch(`/property/property-modules/${existing.id}/`, {
          method: "PATCH",
          // This screen manages every property in the portfolio. Keep writes in
          // the same scope as the list request; otherwise an assignment for a
          // property other than the header selection is intentionally hidden by
          // the API and the detail update returns 404.
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfFromCookie(),
            "X-Property-Scope": "portfolio",
          },
          body: JSON.stringify({ is_enabled: nextEnabled }),
        }, organizationId);
      } else {
        res = await apiFetch("/property/property-modules/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfFromCookie(),
            "X-Property-Scope": "portfolio",
          },
          body: JSON.stringify({ property: property.id, module, is_enabled: nextEnabled }),
        }, organizationId);
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = Object.values(body as Record<string, unknown>).flat().join(" ");
        toast.error(msg || "The module assignment could not be saved.");
        return;
      }
      await load();
    } catch {
      toast.error("Unable to reach the server.");
    } finally {
      setBusy(null);
    }
  }

  const isEnabled = (property: PropertyRow, module: string) => {
    const existing = assignmentFor(property.id, module);
    return existing ? existing.is_enabled : true;
  };

  return (
    <Panel title="Module Access" badge={properties.length}>
      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        Choose which modules each property is available in. Disabling a module hides the property from that
        module&apos;s pickers and blocks new activity, while its existing records stay available in portfolio views and reports.
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}><CircularProgress size={28} /></Box>
      ) : properties.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No properties yet. Onboard a property to assign it to modules.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1, fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>
                  Property
                </TableCell>
                {MODULES.map((m) => (
                  <TableCell key={m.slug} align="center" sx={{ whiteSpace: "nowrap", fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>
                    {m.icon} {m.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id} hover>
                  <TableCell sx={{ position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{property.name}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: "ui-monospace, monospace", color: "text.secondary", display: "block" }}>
                      {property.code ?? ""}
                    </Typography>
                  </TableCell>
                  {MODULES.map((m) => {
                    const enabled = isEnabled(property, m.slug);
                    const key = `${property.id}:${m.slug}`;
                    return (
                      <TableCell key={m.slug} align="center">
                        <button
                          type="button"
                          disabled={busy === key}
                          onClick={() => void toggle(property, m.slug)}
                          title={enabled ? `Disable ${m.label} for ${property.name}` : `Enable ${m.label} for ${property.name}`}
                          style={{ border: "none", background: "transparent", cursor: busy === key ? "wait" : "pointer", padding: 4 }}
                        >
                          <Chip
                            size="small"
                            label={busy === key ? "…" : enabled ? "On" : "Off"}
                            color={enabled ? "success" : "default"}
                            variant={enabled ? "filled" : "outlined"}
                          />
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Panel>
  );
}
