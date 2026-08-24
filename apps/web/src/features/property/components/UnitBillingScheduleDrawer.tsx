"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Divider, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { DetailDrawer, StatusPill, money } from "@/components/module-ui";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import type { UnitRow } from "../types/property.types";

type BillingItem = { id: string; code: string; name: string; calculation: string; is_recurring: boolean };
type ChargeRule = {
  id: string; billing_item: string; billing_item_code: string; billing_item_name: string;
  frequency: string; calculation: string; amount: string; rate: string; billing_day: number;
  custom_interval_months: number; is_active: boolean; instructions: string;
};

const STANDARD_ITEMS = [
  { code: "SECURITY_DEPOSIT", name: "Refundable security deposit", calculation: "fixed", frequency: "one_off", recurring: false },
  { code: "WATER", name: "Water consumption", calculation: "metered", frequency: "metered", recurring: true },
  { code: "ELECTRICITY", name: "Electricity consumption", calculation: "metered", frequency: "metered", recurring: true },
  { code: "SERVICE_CHARGE", name: "Service charge", calculation: "area_rate", frequency: "monthly", recurring: true },
  { code: "PARKING", name: "Parking fee", calculation: "fixed", frequency: "monthly", recurring: true },
] as const;

const EMPTY_FORM = { itemKey: "", frequency: "monthly", calculation: "fixed", amount: "", rate: "", billing_day: "1", custom_interval_months: "1", instructions: "" };

export function UnitBillingScheduleDrawer({ unit, onClose, onChanged }: { unit: UnitRow; onClose: () => void; onChanged?: () => void }) {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? undefined;
  const [items, setItems] = useState<BillingItem[]>([]);
  const [rules, setRules] = useState<ChargeRule[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    try {
      const [itemResponse, ruleResponse] = await Promise.all([
        apiFetch("/property/billing-items/", {}, organizationId),
        apiFetch(`/property/unit-charge-rules/?unit=${unit.id}`, {}, organizationId),
      ]);
      if (!itemResponse.ok) throw new Error(await apiErrorMessage(itemResponse, "Billing items could not be loaded."));
      if (!ruleResponse.ok) throw new Error(await apiErrorMessage(ruleResponse, "Unit billing rules could not be loaded."));
      const itemData = await itemResponse.json();
      const ruleData = await ruleResponse.json();
      setItems(Array.isArray(itemData) ? itemData : itemData.results ?? []);
      setRules(Array.isArray(ruleData) ? ruleData : ruleData.results ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The unit billing schedule could not be loaded.");
    } finally { setLoading(false); }
  }, [organizationId, unit.id]);

  useEffect(() => { void load(); }, [load]);

  const options = useMemo(() => {
    const existingCodes = new Set(items.map((item) => item.code.toUpperCase()));
    return [
      ...items.map((item) => ({ key: `item:${item.id}`, label: `${item.name} (${item.code})` })),
      ...STANDARD_ITEMS.filter((item) => !existingCodes.has(item.code)).map((item) => ({ key: `standard:${item.code}`, label: `${item.name} — create standard item` })),
    ];
  }, [items]);

  async function selectedBillingItem() {
    if (form.itemKey.startsWith("item:")) return form.itemKey.slice(5);
    const code = form.itemKey.slice("standard:".length);
    const standard = STANDARD_ITEMS.find((item) => item.code === code);
    if (!standard || !organizationId) throw new Error("Select a billing item.");
    const response = await apiFetch("/property/billing-items/", {
      method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ code: standard.code, name: standard.name, calculation: standard.calculation, income_category: standard.code.includes("DEPOSIT") ? "Deposits" : "Property charges", is_recurring: standard.recurring, is_active: true }),
    }, organizationId);
    if (!response.ok) throw new Error(await apiErrorMessage(response, "The standard billing item could not be created."));
    return String((await response.json()).id);
  }

  async function saveRule() {
    if (!organizationId || !form.itemKey) { setError("Select a billing item."); return; }
    setSaving(true); setError("");
    try {
      await apiFetch("/auth/csrf/", {}, organizationId);
      const billingItem = await selectedBillingItem();
      const response = await apiFetch(editingId ? `/property/unit-charge-rules/${editingId}/` : "/property/unit-charge-rules/", {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          unit: unit.id, billing_item: billingItem, frequency: form.frequency,
          calculation: form.calculation, amount: Number(form.amount || 0), rate: Number(form.rate || 0),
          billing_day: Number(form.billing_day || 1), custom_interval_months: Number(form.custom_interval_months || 1),
          instructions: form.instructions, is_active: true,
        }),
      }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The billing rule could not be saved."));
      setForm(EMPTY_FORM); setEditingId(null); await load(); onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The billing rule could not be saved."); }
    finally { setSaving(false); }
  }

  async function removeRule(rule: ChargeRule) {
    if (!organizationId || !window.confirm(`Remove ${rule.billing_item_name} from Unit ${unit.code}? Existing signed leases will keep their snapshot.`)) return;
    setSaving(true); setError("");
    try {
      await apiFetch("/auth/csrf/", {}, organizationId);
      const response = await apiFetch(`/property/unit-charge-rules/${rule.id}/`, { method: "DELETE", headers: { "X-CSRFToken": csrfFromCookie() } }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The billing rule could not be removed."));
      await load(); onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The billing rule could not be removed."); }
    finally { setSaving(false); }
  }

  function editRule(rule: ChargeRule) {
    setEditingId(rule.id);
    setForm({ itemKey: `item:${rule.billing_item}`, frequency: rule.frequency, calculation: rule.calculation, amount: String(rule.amount), rate: String(rule.rate), billing_day: String(rule.billing_day), custom_interval_months: String(rule.custom_interval_months), instructions: rule.instructions || "" });
  }

  const deposit = rules.filter((rule) => rule.billing_item_code.toUpperCase().includes("DEPOSIT") && rule.is_active).reduce((sum, rule) => sum + (rule.calculation === "area_rate" ? Number(unit.area || 0) * Number(rule.rate || 0) : Number(rule.amount || 0)), 0);

  return (
    <DetailDrawer title={`Unit ${unit.code} · Billing schedule`} width={720} onClose={onClose}>
      <Stack spacing={2.25}>
        <Alert severity="info">These rules belong to the unit. A new lease receives a frozen copy, so later changes do not rewrite an existing tenant’s contract.</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary">Configured items</Typography><Typography variant="h6">{rules.length}</Typography></Paper>
          <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary">Refundable deposit</Typography><Typography variant="h6">{money.format(deposit)}</Typography></Paper>
          <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary">Unit area</Typography><Typography variant="h6">{Number(unit.area || 0).toLocaleString()} sq.ft</Typography></Paper>
        </Box>

        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Current schedule</Typography>
        {loading ? <Typography color="text.secondary">Loading billing schedule…</Typography> : rules.length === 0 ? <Alert severity="warning">No billing items are configured. Add rent-related utilities, service charge and the refundable deposit before assigning a tenant.</Alert> : (
          <Stack spacing={1}>
            {rules.map((rule) => <Paper key={rule.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack sx={{ flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 1.5 }}>
                <Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{rule.billing_item_name}</Typography><Typography variant="caption" color="text.secondary">{rule.billing_item_code} · {rule.frequency.replaceAll("_", " ")} · day {rule.billing_day}</Typography></Box>
                <Stack sx={{ flexDirection: "row", gap: 1, alignItems: "center", flexWrap: "wrap" }}><StatusPill value={rule.is_active ? "active" : "inactive"} /><Chip size="small" label={rule.calculation === "metered" ? "Approved meter reading" : rule.calculation === "area_rate" ? `${money.format(Number(rule.rate))}/sq.ft` : money.format(Number(rule.amount))} /><Button size="small" onClick={() => editRule(rule)}>Edit</Button><Button size="small" color="error" onClick={() => void removeRule(rule)}>Remove</Button></Stack>
              </Stack>
            </Paper>)}
          </Stack>
        )}

        <Divider />
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{editingId ? "Edit billing item" : "Add billing item"}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 1.5 }}>
          <TextField select label="Billing item" value={form.itemKey} disabled={Boolean(editingId)} onChange={(event) => {
            const itemKey = event.target.value; const standard = STANDARD_ITEMS.find((item) => itemKey === `standard:${item.code}`); const existing = items.find((item) => itemKey === `item:${item.id}`);
            setForm((current) => ({ ...current, itemKey, calculation: standard?.calculation ?? existing?.calculation ?? current.calculation, frequency: standard?.frequency ?? current.frequency }));
          }}>{options.map((option) => <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>)}</TextField>
          <TextField select label="Frequency" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>{["monthly", "quarterly", "biannual", "annual", "one_off", "metered", "custom"].map((value) => <MenuItem key={value} value={value}>{value.replaceAll("_", " ")}</MenuItem>)}</TextField>
          <TextField select label="Calculation" value={form.calculation} onChange={(event) => setForm({ ...form, calculation: event.target.value })}>{["fixed", "area_rate", "metered", "manual"].map((value) => <MenuItem key={value} value={value}>{value.replaceAll("_", " ")}</MenuItem>)}</TextField>
          {form.calculation === "area_rate" || form.calculation === "metered" ? <TextField label={form.calculation === "metered" ? "Tariff per unit" : "Rate per sq.ft"} type="number" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} /> : <TextField label="Amount (KES)" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />}
          <TextField label="Billing day" type="number" value={form.billing_day} slotProps={{ htmlInput: { min: 1, max: 28 } }} onChange={(event) => setForm({ ...form, billing_day: event.target.value })} />
          <TextField label="Instructions" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} />
        </Box>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}><Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); }}>Clear</Button><Button variant="contained" disabled={saving || !form.itemKey} onClick={() => void saveRule()}>{saving ? "Saving…" : editingId ? "Update rule" : "Add to unit"}</Button></Stack>
      </Stack>
    </DetailDrawer>
  );
}
